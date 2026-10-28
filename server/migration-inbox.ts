// Operator-only maintenance receiver. Never imported by the normal app bootstrap.
import express from 'express';
import Stripe from 'stripe';
import {createCipheriv,createDecipheriv,createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';

type Env=Record<string,string|undefined>;
type Event={route:string;body:string;receivedAt:string};
const routes=new Set(['/api/webhooks/asaas','/api/webhooks/asaas/sandbox','/api/webhooks/asaas/production','/api/stripe/webhook']);
const equal=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
const digest=(route:string,body:string)=>createHash('sha256').update(route+'\n'+body).digest('hex');
const token=(route:string,env:Env)=>route.endsWith('/sandbox')?env.ASAAS_SANDBOX_WEBHOOK_TOKEN:route.endsWith('/production')?env.ASAAS_PRODUCTION_WEBHOOK_TOKEN:env.ASAAS_WEBHOOK_TOKEN||env.ASAAS_WEBHOOK_SECRET;
const keyOf=(env:Env)=>{const value=env.BUILT_MIGRATION_INBOX_KEY||'';if(!/^[a-f0-9]{64}$/i.test(value))throw new Error('Chave privada da manutenção ausente.');return Buffer.from(value,'hex');};
async function syncDirectory(directory:string){if(process.platform!=='win32'){const dir=await fs.open(directory,'r');try{await dir.sync();}finally{await dir.close();}}}

export class MigrationInbox {
  private key:Buffer;
  constructor(readonly directory:string,readonly env:Env=process.env){
    if(!path.isAbsolute(directory))throw new Error('Diretório privado obrigatório.');
    this.key=keyOf(env);
  }
  private async root(){
    const stat=await fs.lstat(this.directory);
    if(!stat.isDirectory()||stat.isSymbolicLink()||(process.platform!=='win32'&&(stat.mode&0o077)!==0))throw new Error('Diretório da fila precisa ser privado.');
    return fs.realpath(this.directory);
  }
  async accept(route:string,body:Buffer,headers:Record<string,string|undefined>):Promise<{status:number}> {
    if(!routes.has(route))return {status:404};
    if(body.length>100*1024)return {status:413};
    const text=body.toString('utf8');
    try{JSON.parse(text);}catch{return {status:400};}
    if(route==='/api/stripe/webhook'){
      if(!this.env.STRIPE_WEBHOOK_SECRET)return {status:503};
      try{new Stripe('offline-signature-verification').webhooks.constructEvent(body,headers['stripe-signature']||'',this.env.STRIPE_WEBHOOK_SECRET);}catch{return {status:401};}
    }else{
      const expected=token(route,this.env);if(!expected)return {status:503};
      const received=headers['asaas-access-token']||headers['x-asaas-access-token']||headers.asaas_access_token||headers.authorization?.replace(/^Bearer\s+/i,'')||'';
      const matches=equal(received,expected)||(route==='/api/webhooks/asaas'&&!!this.env.ASAAS_WEBHOOK_SECRET&&equal(received,this.env.ASAAS_WEBHOOK_SECRET));
      if(!matches)return {status:401};
    }
    const root=await this.root(), id=digest(route,text), file=path.join(root,id+'.json');
    try{await fs.access(file);await this.read(id);await syncDirectory(root);return {status:200};}catch(error:any){if(error.code!=='ENOENT')throw error;}
    const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key,iv);
    cipher.setAAD(Buffer.from(id));
    const encrypted=Buffer.concat([cipher.update(JSON.stringify({route,body:text,receivedAt:new Date().toISOString()} satisfies Event)),cipher.final()]);
    const envelope=JSON.stringify({version:1,iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex'),ciphertext:encrypted.toString('base64')});
    const temporary=path.join(root,id+'.'+randomBytes(8).toString('hex')+'.pending');
    const handle=await fs.open(temporary,'wx',0o600);
    try{await handle.writeFile(envelope);await handle.sync();}finally{await handle.close();}
    // Link is atomic and never overwrites an acknowledged event. Keep the journal
    // and temporary copy for operator recovery; no automatic retention/deletion.
    try{await fs.link(temporary,file);}catch(error:any){if(error.code!=='EEXIST')throw error;await this.read(id);}
    await syncDirectory(root);
    return {status:200};
  }
  async read(id:string):Promise<Event>{
    if(!/^[a-f0-9]{64}$/.test(id))throw new Error('Identificador inválido.');
    const root=await this.root(),file=path.join(root,id+'.json');
    if((await fs.lstat(file)).isSymbolicLink())throw new Error('Arquivo inválido.');
    const data=JSON.parse(await fs.readFile(file,'utf8'));
    if(data.version!==1)throw new Error('Versão de fila inválida.');
    const cipher=createDecipheriv('aes-256-gcm',this.key,Buffer.from(data.iv,'hex'));
    cipher.setAAD(Buffer.from(id));cipher.setAuthTag(Buffer.from(data.tag,'hex'));
    const event=JSON.parse(Buffer.concat([cipher.update(Buffer.from(data.ciphertext,'base64')),cipher.final()]).toString()) as Event;
    if(!routes.has(event.route)||typeof event.body!=='string'||Buffer.byteLength(event.body)>100*1024||digest(event.route,event.body)!==id)throw new Error('Evento inválido.');
    return event;
  }
  async replay(target:string,send:typeof fetch=fetch){
    const url=new URL(target);
    if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('Reprocessamento exige aplicação local explícita.');
    const root=await this.root(),lock=path.join(root,'.replay.lock');
    const lease=await fs.open(lock,'wx',0o600);
    try{return await this.replayLocked(root,url,send);}finally{await lease.close();await fs.unlink(lock);}
  }
  private async replayLocked(root:string,url:URL,send:typeof fetch){
    let delivered=0,alreadyDelivered=0;
    const entries=[];
    for(const file of (await fs.readdir(root)).filter(f=>/^[a-f0-9]{64}\.json$/.test(f))){
      const id=file.slice(0,-5);entries.push({id,event:await this.read(id)});
    }
    entries.sort((a,b)=>a.event.receivedAt.localeCompare(b.event.receivedAt)||a.id.localeCompare(b.id));
    for(const {id,event} of entries){
      const receipt=path.join(root,id+'.receipt');
      try{await fs.access(receipt);alreadyDelivered++;continue;}catch(error:any){if(error.code!=='ENOENT')throw error;}
      const headers:Record<string,string>={'content-type':'application/json'};
      if(event.route==='/api/stripe/webhook'){
        const secret=this.env.STRIPE_WEBHOOK_SECRET;if(!secret)throw new Error('Credencial do destino ausente.');
        const timestamp=Math.floor(Date.now()/1000);
        headers['stripe-signature']=`t=${timestamp},v1=${createHmac('sha256',secret).update(timestamp+'.'+event.body).digest('hex')}`;
      }else{const secret=token(event.route,this.env);if(!secret)throw new Error('Credencial do destino ausente.');headers['asaas-access-token']=secret;}
      // The encrypted inbox proves arrival-time verification. Replay goes through
      // the original authenticated/idempotent handlers, with the same event IDs.
      const response=await send(new URL(event.route,url),{method:'POST',headers,body:event.body,redirect:'error',signal:AbortSignal.timeout(30000)});
      if(!response.ok)throw new Error('Destino recusou o evento; fila preservada.');
      const result=await response.json();
      if(result?.received!==true||result?.queued===true)throw new Error('Destino ainda não confirmou processamento.');
      const handle=await fs.open(receipt,'wx',0o600);
      try{await handle.writeFile(JSON.stringify({processedAt:new Date().toISOString()}));await handle.sync();}finally{await handle.close();}
      await syncDirectory(root);delivered++;
    }
    return {delivered,alreadyDelivered};
  }
}

export function maintenanceApp(inbox:MigrationInbox){
  const app=express();
  app.disable('x-powered-by');
  app.get('/health',(_req,res)=>res.json({mode:'maintenance',ready:true}));
  app.post([...routes],express.raw({type:()=>true,limit:'100kb'}),async(req,res)=>{
    try{
      const headers=Object.fromEntries(Object.entries(req.headers).map(([key,value])=>[key,Array.isArray(value)?value[0]:value]));
      // Legacy token-in-query remains compatible; it is never logged or persisted.
      headers['asaas-access-token']??=typeof req.query.token==='string'?req.query.token:typeof req.query.access_token==='string'?req.query.access_token:undefined;
      const result=await inbox.accept(req.path,Buffer.isBuffer(req.body)?req.body:Buffer.alloc(0),headers);
      return res.status(result.status).json(result.status===200?{received:true,queued:true}:{received:false});
    }catch{return res.status(503).json({received:false});}
  });
  app.use((_req,res)=>res.set('Retry-After','60').status(503).json({error:'Plataforma em manutenção. Tente novamente em alguns minutos.'}));
  app.use((error:any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>res.status(error.type==='entity.too.large'?413:503).json({received:false}));
  return app;
}

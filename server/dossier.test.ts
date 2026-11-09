import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFDict, PDFName, PDFArray, PDFHexString, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { buildDossier, dossierEntries, dossierYear } from './dossier';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import * as dossierModule from './dossier';

test('PDF com sumário navegável, paginação após quebra de extrato e arquivos originais íntegros', async () => {
  const blank = await PDFDocument.create();
  blank.addPage([595,842]).drawText('BUILT');
  const template = await blank.save();
  const entries = Array.from({length:45},(_,i)=>({id:String(i),descricao:'Lançamento de teste',tipo:'entrada',valor:10,status:'pago',data:'2025-01-01',data_pagamento:'2026-01-02'}));
  const previous = {...entries[0],id:'excluido',data_pagamento:'2025-01-02'};
  assert.equal(dossierEntries([...entries, previous],2026).length,45);
  const source = {name:'BIA de teste',currency:'BRL',entries:[...entries,previous],notes:[],files:[{id:'r',name:'recibo.pdf',folder:'Documentos'},{id:'m',name:'MAP.pdf',folder:'MAP'}]};
  const out = await buildDossier(source,2026,async()=>({bytes:template}),()=>template);
  assert.equal(Buffer.from(out).subarray(0,5).toString(),'%PDF-');
  const pdf = await PDFDocument.load(out);
  const pages = pdf.getPages();
  const links = pages[0].node.Annots()!;
  assert.equal(links.size(),5);
  const destinations = links.asArray().map(a=>{
    const dest=pdf.context.lookup(a,PDFDict).lookup(PDFName.of('Dest'),PDFArray);
    return pages.findIndex(p=>p.ref === dest.get(0));
  });
  assert.deepEqual(destinations.slice(0,2),[1,2]);
  assert.ok(destinations[2]>3,'extrato de várias páginas altera a posição dos anexos');
  assert.equal(destinations.at(-1),pages.length-1);
  const names=pdf.catalog.lookup(PDFName.of('Names'),PDFDict).lookup(PDFName.of('EmbeddedFiles'),PDFDict).lookup(PDFName.of('Names'),PDFArray);
  const files=new Map<string,Buffer>();
  for(let i=0;i<names.size();i+=2){
    const spec=names.lookup(i+1,PDFDict);
    const stream=spec.lookup(PDFName.of('EF'),PDFDict).lookup(PDFName.of('F'),PDFRawStream);
    files.set(names.lookup(i,PDFHexString).decodeText(),Buffer.from(decodePDFRawStream(stream).decode()));
  }
  assert.deepEqual(files.get('1-recibo.pdf'),Buffer.from(template));
  assert.deepEqual(files.get('2-MAP.pdf'),Buffer.from(template));
  assert.doesNotMatch(files.get('Extrato.csv')!.toString(),/excluido/);
  assert.equal(JSON.parse(files.get('Manifesto.json')!.toString()).arquivos.length,2);
});

test('arquivo ausente ou limite não produz PDF parcial; ano inválido é rejeitado', async () => {
  assert.throws(()=>dossierYear('2026&other=1'));
  const source={name:'Teste',currency:'BRL',entries:[],notes:[],files:[{id:'1',name:'a',folder:'Docs'}]};
  const base=await PDFDocument.create(); base.addPage().drawText('BUILT'); const bytes=await base.save();
  await assert.rejects(buildDossier(source,2026,async()=>{throw new Error('offline');},()=>bytes),/offline/);
  await assert.rejects(buildDossier({...source,files:Array(301).fill(source.files[0])},2026,async()=>({bytes:new Uint8Array()}),()=>new Uint8Array()),/300/);
});

test('rotas reais negam acesso antes de ler dados ou arquivos; propriedade não usa MAP', async () => {
  const s=readFileSync(new URL('./routes.ts',import.meta.url),'utf8');
  const chunk=s.slice(s.indexOf("  app.get('/api/carteira/imoveis/:id/dossie'"),s.indexOf('  app.get("/api/carteira/imoveis/:id/documentos"'));
  const handlers: Record<string,Function>={};
  let reads=0;
  new Function('app','requireCarteiraActor','requireCarteiraAccess','resolveBiaByIdOrPublicCode','requireBiaModuleAccess','db',transformSync(chunk,{loader:'ts'}).code)(
    {get:(p:string,h:Function)=>handlers[p]=h},()=>({}),async()=>{throw Object.assign(new Error('negado'),{status:403});},async()=>({id:'bia'}),async(_:any,res:any)=>{res.status(403).json({});return false;},{execute:()=>{reads++;throw new Error('não deve ler');}}
  );
  for(const [path,h] of Object.entries(handlers)) {
    let status=200; const res:any={status:(v:number)=>{status=v;return res;},json:()=>{}};
    await h({params:{id:'other'},session:{directusUserId:'user'},query:{ano:'2026'}},res);
    assert.equal(status,403,path);
  }
  assert.equal(reads,0);
  let status=200;const res:any={status:(v:number)=>{status=v;return res;},json:()=>{}};
  await handlers['/api/bias/:id/dossie']({session:{},params:{id:'bia'}},res);
  assert.equal(status,401);
});

test('BIA autorizada exporta só sua origem e núcleos permitidos; falha financeira não vira vazio', async () => {
  const s=readFileSync(new URL('./routes.ts',import.meta.url),'utf8');
  const code=s.slice(s.indexOf("  app.get('/api/bias/:id/dossie'"),s.indexOf('  app.get("/api/carteira/imoveis/:id/documentos"')).replace("await import('./dossier')",'dossierModule');
  let handler: any, output: any, fail=false;
  const scope: any = {
    app:{get:(_:any,h:any)=>handler=h}, dossierModule,
    resolveBiaByIdOrPublicCode:async()=>({id:'mine',nome_bia:'Minha BIA',moeda:'BRL'}),requireBiaModuleAccess:async()=>true,
    resolveBiaAccessForRequest:async()=>({permissions:{}}),hasBiaAccess:(_:any,key:string)=>key==='documentos_capital',
    DIRECTUS_URL:'http://fixture',DIRECTUS_TOKEN:'test',
    fetch:async()=>({ok:!fail,json:async()=>({data:[{id:'mine-flow',bia:'mine',data:'2026-01-01',Anexos:[{directus_files_id:{id:'receipt'}}]},{id:'other-flow',bia:'other',data:'2026-01-01',Anexos:[]}]})}),
    fluxoBiaId:(e:any)=>e.bia,initialEntryMetadata:async(e:any)=>e,
    db:{select:()=>({from:async()=>[{id:'doc',bia_id:'mine',modulo:'capital',arquivo_ids:['doc-file']},{id:'private',bia_id:'other',modulo:'capital',arquivo_ids:['secret']}]}),execute:async()=>({rows:[]})},
    nucleoTecnicoDocs:{},aliancaDocs:{},nucleoTecnicoDocsFallback:[],listFallbackDocuments:()=>[],sql:()=>({}),
    sendDossier:async(_:any,source:any)=>{output=source;},buildSimpleTextPdf:()=>new Uint8Array(),
  };
  new Function(...Object.keys(scope),transformSync(code,{loader:'ts'}).code)(...Object.values(scope));
  let status=200;const res:any={status:(v:number)=>{status=v;return res;},json:()=>{}};
  const req={session:{directusUserId:'user'},params:{id:'mine'},query:{ano:'2026'}};
  await handler(req,res);
  assert.equal(status,200);assert.deepEqual(output.entries.map((e:any)=>e.id),['mine-flow']);
  assert.deepEqual(output.files.map((f:any)=>f.id),['receipt','doc-file']);
  assert.equal(output.notes.filter((s:string)=>s.includes('permissão')).length,3);
  fail=true;output=null;await handler(req,res);assert.equal(status,503);assert.equal(output,null);
});

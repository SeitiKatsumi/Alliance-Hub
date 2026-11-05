import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { buildDossier, dossierEntries, dossierYear } from './dossier';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import * as dossierModule from './dossier';

test('ZIP preserva bytes, rastreia arquivos e separa ano, pago, pendente e não caixa', async () => {
  const entries = [
    {id:'1',tipo:'entrada',valor:100.10,status:'pago',data:'2025-12-31',data_pagamento:'2026-01-01',descricao:'=HYPERLINK("bad")'},
    {id:'2',tipo:'saida',valor:20.05,status:'pago',data:'2026-02-01'},
    {id:'3',tipo:'saida',valor:500,status:'pendente',data:'2026-02-01'},
    {id:'4',tipo:'entrada',valor:900,status:'pago',natureza:'nao_caixa',data:'2026-02-01'},
    {id:'5',tipo:'entrada',valor:1000,status:'pago',data:'2027-02-01'},
  ];
  const bytes = new Uint8Array([1,2,3]);
  const result = unzipSync(await buildDossier({name:'Teste',currency:'BRL',entries,notes:[],files:[{id:'file',name:'../../recibo.pdf',folder:'Documentos'}]}, 2026, async () => ({bytes}), (_,body) => new TextEncoder().encode(body)));
  assert.match(strFromU8(result['Resumo.pdf']), /Entradas pagas: BRL 100.10/);
  assert.match(strFromU8(result['Resumo.pdf']), /Resultado registrado: BRL 80.05/);
  assert.equal(dossierEntries(entries, 2026).length,4);
  assert.match(strFromU8(result['Extrato.csv']), /'=HYPERLINK/);
  const manifest=JSON.parse(strFromU8(result['Manifesto.json']));
  assert.deepEqual(result[manifest.arquivos[0].arquivo],bytes);
  assert.equal(manifest.arquivos[0].sha256.length,64);
  assert.ok(!Object.keys(result).some(k=>k.includes('../')));
});

test('arquivo ausente ou limite não produz ZIP parcial; ano inválido é rejeitado', async () => {
  assert.throws(()=>dossierYear('2026&other=1'));
  const source={name:'Teste',currency:'BRL',entries:[],notes:[],files:[{id:'1',name:'a',folder:'Docs'}]};
  await assert.rejects(buildDossier(source,2026,async()=>{throw new Error('offline');},()=>new Uint8Array()),/offline/);
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

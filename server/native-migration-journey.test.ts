import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { transformSync } from 'esbuild';
import { biaBusinessTypeStoragePayload } from '../shared/bia-business-type';
import { emptyBiaSetup } from '../shared/bia-setup';

const source=readFileSync(new URL('./routes.ts',import.meta.url),'utf8');
test('migration: concluding a BIA keeps its versioned structure out of the presentation write',()=>{
  const ast=ts.createSourceFile('routes.ts',source,ts.ScriptTarget.Latest,true);let text='';
  function visit(node:ts.Node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='prepareBiaPayload')text=node.getText(ast);ts.forEachChild(node,visit);}visit(ast);
  const prepare=new Function('biaBusinessTypeStoragePayload','parseBiaMemberList',transformSync(text+'\nreturn prepareBiaPayload;', {loader:'ts'}).code)(biaBusinessTypeStoragePayload,(v:any)=>v);
  const structure=emptyBiaSetup();structure.juridico.responsavel='Synthetic fixture';
  const draft={nome_bia:'Test',estrutura_bia:structure,business_type_code:'FLIPPING',Anexos:['11111111-1111-4111-8111-111111111111']};
  const saved=prepare(draft);
  assert.equal(saved.nome_bia,'Test');assert.equal(saved.objetivo_alianca,'FLIPPING');
  assert.deepEqual(saved.Anexos,[{directus_files_id:'11111111-1111-4111-8111-111111111111'}]);
  assert(!('estrutura_bia' in saved));assert.deepEqual(draft.estrutura_bia,structure,'Retain source for appendBiaSetup');
});
test('migration: editing an OBA reads only physical BIA identity fields before saving',async()=>{
  const start=source.indexOf('  app.patch("/api/oportunidades/:id"');
  const end=source.indexOf('  app.delete("/api/oportunidades/:id"',start);let handler:any,saved:any;
  const scope={app:{patch:(_route:string,fn:any)=>{handler=fn;}},canManageOpa:async()=>true,ensureOpaMediaFields:async()=>{},prepareOpaPayload:(b:any)=>({...b}),
    directusFetchOne:async(collection:string,id:string,params:string)=>{assert.equal(collection,'tipos_oportunidades');assert.equal(id,'test-oba');assert.equal(params,'fields=id,bia');return{id,bia:'test-bia'};},
    directusRelationId:(v:any)=>v?.id||v||null,ensureCanLinkOpaToBia:async()=>{},directusUpdate:async(_c:string,id:string,payload:any)=>{saved={id,...payload};return saved;},syncOpaRegistry:async()=>null,recordOpportunityEvent:async()=>{}};
  new Function(...Object.keys(scope),transformSync(source.slice(start,end),{loader:'ts'}).code)(...Object.values(scope));
  let status=200,body:any;const res:any={status:(n:number)=>{status=n;return res;},json:(data:any)=>{body=data;return res;}};
  await handler({params:{id:'test-oba'},body:{descricao:'Updated'},session:{directusUserId:'fixture'}},res);
  assert.equal(status,200,JSON.stringify(body));assert.equal(saved.descricao,'Updated');assert.equal(body.id,'test-oba');
});

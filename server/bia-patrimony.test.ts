import test from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {drizzle} from "drizzle-orm/pglite";
import {loadBiaPatrimony} from "./bia-patrimony";
import {readFileSync} from "node:fs";
import {transformSync} from "esbuild";
import {sql} from "drizzle-orm";
import {readResolvedBiaSetup} from './bia-setup';

test('editor e patrimônio resolvem o mesmo ativo legado sem gravar ou ressuscitar ativo removido',async()=>{
 const pg=new PGlite();try{
  await pg.exec(`CREATE TABLE bia_estrutura_versoes(bia_id text,revisao int,dados jsonb,evento text,contexto jsonb);
   CREATE TABLE bia_imovel_origens(bia_id text,imovel_id text,status text);
   CREATE TABLE inventario_imoveis(id text,data jsonb);`);
  const db=drizzle(pg);let reads=0;
  const legacy=async()=>{reads++;return {info_comercial:{ativo_cidade:'Lagoa Santa',ativo_numero_matricula:'SECRET'}};};
  const editor=await readResolvedBiaSetup(db,'quintas',legacy);
  const estimate=await loadBiaPatrimony(db,{id:'quintas'},[],legacy);
  assert.equal(editor.dados.ativos[0].id,'ativo-legado');assert.equal(reads,2);
  assert.equal(estimate.partial,true);assert.equal(estimate.value,null);
  assert.match(estimate.issues.join(),/Ativo cadastrado anteriormente: situação não informada/);
  assert.match(estimate.issues.join(),/valor de referência não informado/);
  assert.doesNotMatch(estimate.issues.join(),/Ativos ainda não definidos|SECRET/);
  assert.ok(estimate.issueDetails?.every(i=>i.target==='assets' && i.id==='ativo-legado'));
  assert.equal((await pg.query<any>('SELECT count(*)::int n FROM bia_estrutura_versoes')).rows[0].n,0);
  await pg.exec(`INSERT INTO bia_estrutura_versoes VALUES('quintas',1,'{"ativos":[],"ativosIndefinidos":true}','edicao','{}')`);
  const current=await loadBiaPatrimony(db,{id:'quintas'},[],async()=>{throw new Error('Não ler legado quando já há revisão');});
  assert.match(current.issues.join(),/Ativos ainda não definidos/);
  await assert.rejects(loadBiaPatrimony(db,{id:'failed'},[],async()=>{throw new Error('Fonte indisponível');}));
 }finally{await pg.close();}
});

test("leitura SQL usa somente ativos da BIA, sem transferir propriedade por referência ou alterar fontes",async()=>{
 const pg=new PGlite();try{
  await pg.exec(`CREATE TABLE bia_estrutura_versoes(bia_id text,revisao int,dados jsonb,evento text DEFAULT 'edicao',contexto jsonb);
   CREATE TABLE bia_imovel_origens(bia_id text,imovel_id text,status text);
   CREATE TABLE inventario_imoveis(id text,data jsonb);
   INSERT INTO inventario_imoveis VALUES ('one','{"valor_atual":1000,"divida_saldo":200,"private":"SECRET"}'),('other','{"valor_atual":999999}');
   INSERT INTO bia_imovel_origens VALUES ('bia','one','ativa'),('foreign','other','ativa');
   INSERT INTO bia_estrutura_versoes(bia_id,revisao,dados) VALUES ('bia',1,'{"ativosIndefinidos":false,"ativos":[{"id":"copy","carteiraImovelId":"one","situacao":"Adquirido","valorReferencia":1000},{"id":"reference","carteiraImovelId":"other","situacao":"Adquirido","valorReferencia":999999}]}');`);
  const result=await loadBiaPatrimony(drizzle(pg),{id:'bia',moeda:'BRL'},[]);
  assert.equal(result.value,800);assert.equal(result.partial,true);assert.deepEqual(result.propertyIds,['one']);assert.doesNotMatch(JSON.stringify(result),/SECRET|999999/);
  assert.equal((await pg.query<any>('SELECT count(*)::int AS n FROM bia_estrutura_versoes')).rows[0].n,1);
  await pg.exec('DROP TABLE bia_imovel_origens');await assert.rejects(loadBiaPatrimony(drizzle(pg),{id:'bia'},[]));
 }finally{await pg.close();}
});

test("Carteira exige vínculo e leitura financeira antes das fontes, sem substituir falha por zero",async()=>{
 const source=readFileSync(new URL('./routes.ts',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('  async function carteiraAlliancesForMember('),source.indexOf('  const MARKET_ESTIMATE_MAX_AGE_MS'));
 let allowed=false,reads=0,fail=false,partial=true,legacy=false,propertyIssues=false,propertyEditable=false;
 const entries=[{tipo:'entrada',valor:100,status:'pago'},{tipo:'entrada',valor:1000,status:'pendente'},{tipo:'entrada',valor:100,status:'pago',finalidade:'integralizacao_inicial'},{tipo:'saida',valor:40,status:'pago'},{tipo:'saida',valor:60,status:'pendente'},{tipo:'saida',valor:1000,status:'cancelado'}];
 const scope={requireCarteiraActor:()=>({isPlatformAdmin:true}),resolveCarteiraAccess:async(id:string,actor:any)=>{assert.equal(id,'owned');assert.equal(actor.isPlatformAdmin,false);return propertyEditable?{nivel:'administracao'}:null;},directusFetchScoped:async(collection:string)=>{if(collection==='bias_projetos')return [{id:'bia',moeda:'BRL'}];reads++;if(fail)throw new Error('indisponível');return entries;},isUserLinkedToBia:(_bia:any,id:string)=>id==='member',resolveBiaAccessForRequest:async()=>({permissions:{}}),hasBiaAccess:()=>allowed,loadInitialMapSnapshot:async()=>legacy?null:{modelo_calculo:5},getBiaAllocationMap:async()=>{reads++;return [{memberId:'member',percent:25,value:100}];},memberContributionProgress:()=>({committed:100,paid:25,percentage:25,partial:false}),loadBiaPatrimony:async()=>{reads++;return {value:200,partial,issueDetails:propertyIssues?[{target:'property',id:'owned',message:'Valor ausente'}]:[],calculatedAt:'2026-10-22T00:00:00Z',propertyIds:[]};},db:{execute:async()=>({rows:[]})},sql,canDeleteBia:async()=>false,isCashEntry:()=>true,parseMarketValueServer:Number};
 const fn=new Function(...Object.keys(scope),transformSync(code,{loader:'ts'}).code+';return carteiraAlliancesForMember;')(...Object.values(scope));
 assert.deepEqual(await fn('member',{}),[]);assert.equal(reads,0);allowed=true;
 assert.deepEqual(await fn('other',{}),[]);assert.equal(reads,0);
 const result=await fn('member',{});assert.equal(result[0].valor_participacao,null);assert.equal(result[0].patrimonio_liquido_oficial,null);assert.equal(result[0].confirmado,false);assert.equal(result[0].evolucao_patrimonial_percentual,null);
 partial=false;const complete=await fn('member',{});assert.equal(complete[0].valor_participacao,50);assert.equal(complete[0].evolucao_patrimonial_percentual,-50);
 assert.equal(complete[0].cpp_aportado,25);assert.equal(complete[0].cpp_a_aportar,75);assert.equal(complete[0].cpp_integralizacao.percentage,25);
 legacy=true;const compatible=await fn('member',{});assert.equal(compatible[0].cpp_aportado,100);assert.equal(compatible[0].cpp_a_aportar,0);
 propertyIssues=true;assert.deepEqual((await fn('member',{}))[0].editable_patrimony_property_ids,[]);
 propertyEditable=true;assert.deepEqual((await fn('member',{}))[0].editable_patrimony_property_ids,['owned']);
 assert.equal(result[0].receitas_participacao,25);assert.equal(result[0].despesas_participacao,10);assert.equal(result[0].contas_a_pagar_participacao,15);
 fail=true;await assert.rejects(fn('member',{}));
});

test("registro manual fica aposentado após autorização, histórico preservado por ID canônico",async()=>{
 const source=readFileSync(new URL('./routes.ts',import.meta.url),'utf8');
 const begin=source.indexOf('  app.get("/api/bias/:id/patrimonio"');
 const code=source.slice(begin,source.indexOf('  app.get("/api/bias/:id/aporte-solicitacoes"',begin));
 const handlers=new Map<string,any>();let allowed=false,reads=0,status=200;
 const scope={app:{get:(path:string,fn:any)=>handlers.set('GET',fn),post:(path:string,fn:any)=>handlers.set('POST',fn)},requireBiaModuleAccess:async()=>allowed?{bia:{id:'canonical'}}:null,db:{execute:async()=>{reads++;return {rows:[]};}},sql};
 new Function(...Object.keys(scope),transformSync(code,{loader:'ts'}).code)(...Object.values(scope));
 const res:any={json:()=>{},status:(value:number)=>{status=value;return res;}};
 await handlers.get('POST')({params:{id:'PUBLIC'}},res);assert.equal(reads,0);allowed=true;
 await handlers.get('POST')({params:{id:'PUBLIC'}},res);assert.equal(status,410);assert.equal(reads,0);
 await handlers.get('GET')({params:{id:'PUBLIC'}},res);assert.equal(reads,1);
 assert.match(code,/String\(auth.bia.id\)/);assert.doesNotMatch(code,/INSERT|UPDATE|DELETE/);
});

test('SQL usa edição vigente, fração explícita e dívida; não usa VGV nem ativação histórica como valor atual',async()=>{
 const pg=new PGlite();try{
  await pg.exec(`CREATE TABLE bia_estrutura_versoes(bia_id text,revisao int,dados jsonb,evento text,contexto jsonb);
   CREATE TABLE bia_imovel_origens(bia_id text,imovel_id text,status text);
   CREATE TABLE inventario_imoveis(id text,data jsonb);
   INSERT INTO bia_estrutura_versoes VALUES ('bia',1,'{"ativosIndefinidos":false,"ativos":[{"id":"owned","situacao":"Adquirido","valorReferencia":1000000,"participacaoBiaPercentual":50,"dividaSaldo":200000},{"id":"sale","situacao":"Em negociação","valorReferencia":99999999,"participacaoBiaPercentual":100,"dividaSaldo":0}]}','edicao','{}'),
   ('bia',2,'{"ativosIndefinidos":true,"ativos":[]}', 'ativacao:recuperada','{}');`);
  const result=await loadBiaPatrimony(drizzle(pg),{id:'bia'},[{id:'cash',tipo:'entrada',status:'pago',valor:10000}]);
  assert.equal(result.value,410000);assert.equal(result.partial,false);assert.equal(result.assets,500000);assert.equal(result.debt,100000);
  await pg.exec(`INSERT INTO inventario_imoveis VALUES('origin','{"valor_atual":1000,"divida_saldo":0}');INSERT INTO bia_imovel_origens VALUES('formal','origin','ativa');`);
  const formal=await loadBiaPatrimony(drizzle(pg),{id:'formal'},[]);
  assert.equal(formal.value,1000);assert.equal(formal.partial,false);assert.deepEqual(formal.propertyIds,['origin']);
  const legacy=await loadBiaPatrimony(drizzle(pg),{id:'legacy'},[{id:'cash',tipo:'entrada',status:'pago',valor:500}]);
  assert.equal(legacy.value,500);assert.equal(legacy.partial,true);assert.match(legacy.issues.join(),/Ativos ainda não definidos/);
 }finally{await pg.close();}
});

test('origem formal não retorna ao total pessoal quando valor da BIA está incompleto ou sem câmbio',()=>{
 const source=readFileSync(new URL('./routes.ts',import.meta.url),'utf8');
 const begin=source.indexOf('      const propertiesInBias=');
 const code=source.slice(begin,source.indexOf('      const consolidated =',begin));
 const fn=new Function('aliancas','imoveis',transformSync(code,{loader:'ts'}).code+';return imoveis;');
 const rows=fn([{map_percent:25,valor_participacao:null,moeda:'USD',estimativa_patrimonial:{propertyIds:['owned']}},{map_percent:0,estimativa_patrimonial:{propertyIds:['no-map']}}],[{id:'owned'},{id:'no-map'},{id:'personal'}]);
 assert.deepEqual(rows.map((r:any)=>r.consolidado_via_bia),[true,false,false]);
 assert.equal((source.match(/imoveis\.filter\(item=>!propertiesInBias\.has\(String\(item\.id\)\)\)\.map/g)||[]).length,2);
});

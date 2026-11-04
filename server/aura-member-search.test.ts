import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

test('eligible lookup scopes before the100-result limit and excludes previous evaluations; provider failure is not an empty list',async()=>{
 const source=fs.readFileSync('server/routes.ts','utf8');
 const start=source.indexOf('  app.get("/api/aura/membros/busca",');
 const route=source.slice(start,source.indexOf('\n  // GET /api/aura/vinculos',start));
 let handler:any;let captured:URL|undefined;let fail=false;let calls=0;
 const injected={app:{get:(_path:string,fn:any)=>{handler=fn;}},blockVitrineOnlyAura:async()=>false,getAuraAccessContext:async()=>({membroId:'self',canConsultAura:true,canRegisterAura:true}),getAuraLinkedMemberIdsServer:async()=>new Set(['self','linked','evaluated']),storage:{getAuraAvaliacoesByAvaliador:async()=>[{avaliado_membro_id:'evaluated'}]},DIRECTUS_URL:'https://provider.invalid',DIRECTUS_TOKEN:'fixture',fetch:async(url:string)=>{calls++;captured=new URL(url);return {ok:!fail,json:async()=>({data:[{id:'linked',nome:'Pessoa'}]})}}};
 new Function(...Object.keys(injected),ts.transpileModule(route,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText)(...Object.values(injected));
 const run=async(query:any,session:any={directusUserId:'u'})=>{let code=200;let body:any;await handler({query,session},{status(n:number){code=n;return this},json(data:any){body=data;return this}});return{code,body}};
 assert.equal((await run({avaliaveis:'1',q:'Pes'})).code,200);
 assert.equal(captured?.searchParams.get('filter[id][_in]'),'linked');
 assert.equal(captured?.searchParams.get('limit'),'100');
 assert.equal(captured?.searchParams.get('filter[_or][0][nome][_icontains]'),'Pes');
 await run({});assert.equal(captured?.searchParams.has('filter[id][_in]'),false);
 fail=true;assert.equal((await run({avaliaveis:'1'})).code,503);
 const before=calls;assert.equal((await run({},{})).code,401);assert.equal(calls,before);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {DASHBOARD_CAPITAL_QUERY,paidMemberCapital} from '../shared/dashboard-capital';

test('dashboard consulta status da fonte oficial, projeta a base paga e sinaliza falha sem inventar zero',async()=>{
 const source=readFileSync(new URL('./routes.ts',import.meta.url),'utf8');
 const ast=ts.createSourceFile('routes.ts',source,ts.ScriptTarget.Latest,true);
 let route:ts.Node|undefined;
 function find(node:ts.Node){if(ts.isCallExpression(node)&&node.expression.getText(ast)==='app.get'&&node.arguments[0]?.getText(ast)==='"/api/dashboard"')route=node.arguments[1];ts.forEachChild(node,find);}find(ast);assert.ok(route);
 let load:ts.Expression|undefined;
 function findLoad(node:ts.Node){if(ts.isCallExpression(node)&&node.expression.getText(ast)==='directusFetchScoped'&&node.arguments[1]?.getText(ast)==='DASHBOARD_CAPITAL_QUERY')load=node.parent.parent as ts.Expression;ts.forEachChild(node,findLoad);}findLoad(route);assert.ok(load);
 // Execute the actual producer's fetch expression with a Directus-shaped projection.
 const get=new Function('directusFetchScoped','DASHBOARD_CAPITAL_QUERY',`return ${load.getText(ast)};`);
 const records=[{id:'paid',bia:'b',tipo:'entrada',status:'pago',valor:100,favorecido_id:'me'},{id:'open',bia:'b',tipo:'entrada',status:'pendente',valor:5000,favorecido_id:'me'}];
 const items=await get(async(collection:string,query:string)=>{
   assert.equal(collection,'fluxo_caixa');const params=new URLSearchParams(query);assert.equal(params.get('limit'),'-1');
   const fields=(params.get('fields')||'').split(',');
   return records.filter(row=>!params.has('filter[status][_eq]')||row.status===params.get('filter[status][_eq]')).map(row=>Object.fromEntries(fields.map(field=>[field,(row as any)[field]])));
 },DASHBOARD_CAPITAL_QUERY);
 assert.equal(paidMemberCapital(items,'me',['b']).get('b')?.invested,100);
 assert.equal(await get(async()=>{throw new Error('source unavailable');},DASHBOARD_CAPITAL_QUERY),null);
 const text=route.getText(ast);
 assert.match(text,/paidMemberCapital\(fluxoCaixa \|\| \[\],membroId,userBiaIds\)/);
 assert.match(text,/financeiro_disponivel: fluxoCaixa !== null/);
 assert.match(text,/investimento_usuario_valor: fluxoCaixa === null \? null : alocacao\.invested/);
});

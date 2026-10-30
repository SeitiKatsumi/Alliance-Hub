import test from "node:test";
import assert from "node:assert/strict";
import {portfolioComposition} from "./portfolio-composition";
test("composição conta imóveis únicos, exclui os consolidados pela BIA e não presume ocupação", () => {
 const result = portfolioComposition([{id:"a",tipo:"Casa",ocupacao:"ocupado"},{id:"a",tipo:"Casa",ocupacao:"ocupado"},{id:"b",tipo:"Casa",ocupacao:"uso_proprio"},{id:"c",ocupacao:"qualquer"},{id:"bia",tipo:"Terreno",consolidado_via_bia:true}]);
 assert.equal(result.total,3);assert.equal(result.types.find(x=>x.name==="Casa")?.value,2);
 assert.equal(result.occupancy.find(x=>x.name==="Não informado")?.value,1);
 assert.equal(result.occupancy.find(x=>x.name==="Uso próprio")?.value,1);
 assert.ok(Math.abs(result.types.reduce((s,x)=>s+x.percent,0)-100)<1e-9);
 assert.deepEqual(portfolioComposition([]),{total:0,occupancy:[],types:[]});
});

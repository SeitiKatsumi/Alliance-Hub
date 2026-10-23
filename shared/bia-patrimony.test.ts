import test from "node:test";
import assert from "node:assert/strict";
import {estimateBiaPatrimony,type BiaPatrimonyAsset} from "./bia-patrimony";
import {calculatePortfolioTotals} from "./member-portfolio";
const asset=(overrides:Partial<BiaPatrimonyAsset>={})=>({id:"property:one",value:1000,debt:200,currency:"BRL",acquired:true,ownershipConfirmed:true,ownershipPercent:100,...overrides});
const calc=(assets:BiaPatrimonyAsset[],entries:any[]=[])=>estimateBiaPatrimony({assets,entries,currency:"BRL",assetsUndefined:false,calculatedAt:"2026-10-22T00:00:00Z"});
const entry=(id:string,tipo:string,valor:number,extra:any={})=>({id,tipo,valor,status:"pago",...extra});
test("aporte utilizado para comprar ativo não conta duas vezes; CPP e promessas não entram",()=>{
  const result=calc([asset({value:1000,debt:0})],[entry("in","entrada",1000),entry("out","saida",1000),entry("right","entrada",500,{natureza:"nao_caixa"}),entry("promise","entrada",2000,{status:"pendente"}),entry("virtual","entrada",1000,{descricao:"Valor de Origem da BIA"})]);
  assert.equal(result.value,1000);assert.equal(result.cash,0);assert.equal(result.partial,false);
});
test("somente pagamentos reais, dedup por ID, sem caixa de cancelamentos/conciliação",()=>{
  const first=entry("paid","entrada",0.1),second=entry("second","entrada",0.2);
  const result=calc([], [first,first,second,entry("cancel","saida",100,{status:"cancelado"}),entry("review","entrada",50,{conciliacao_pendente:true}),entry("old","entrada",50,{parcela_vigente:false})]);
  assert.equal(result.value,0.3);assert.equal(result.partial,true);
});
test("cents, perdas e patrimônio negativo são preservados",()=>{
  assert.equal(calc([asset({value:100.11,debt:20.01})],[entry("out","saida",0.1)]).value,80);
  assert.equal(calc([asset({value:100,debt:300})]).value,-200);
});
test("dados ausentes, referências, moeda diferente, ativo vendido/em negociação não viram patrimônio",()=>{
  assert.equal(calc([]).value,null);
  for(const change of [{value:null},{ownershipConfirmed:false},{currency:"USD"},{acquired:false}])assert.equal(calc([asset(change)]).value,null);
  assert.equal(calc([asset({debt:null})]).value,1000);assert.equal(calc([asset({debt:null})]).partial,true);
  const pending=calc([asset()],[entry("future","saida",500,{status:"agendado"})]);
  assert.equal(pending.value,800);assert.equal(pending.partial,true);
});
test("ativo formal repetido é único; zero informado é diferente de ausência",()=>{
  assert.equal(calc([asset(),asset()]).value,800);
  assert.equal(calc([asset({value:0,debt:0})]).value,0);
  assert.equal(calc([], [entry("broken","entrada",Number.NaN)]).value,null);
});

test("fração da BIA aplica-se ao imóvel e à dívida uma vez; origem sem valor ainda evita duplicação",()=>{
  const result=calc([asset({value:1000000,debt:200000,ownershipPercent:50})],[entry('cash','entrada',10000)]);
  assert.equal(result.assets,500000);assert.equal(result.debt,100000);assert.equal(result.value,410000);assert.equal(result.partial,false);
  for(const ownershipPercent of [null,0,-1,101,NaN])assert.equal(calc([asset({ownershipPercent})]).partial,true);
  for(const patch of [{value:null},{currency:'USD'},{debt:null}])assert.deepEqual(calc([asset(patch)]).propertyIds,['one']);
  assert.deepEqual(calc([asset({ownershipConfirmed:false})]).propertyIds,[]);
  assert.deepEqual(calc([asset({acquired:false})]).propertyIds,[]);
});
test("valorização consolidada reconhece perda total/valor negativo, não confunde com avaliação ausente",()=>{
  const result=calculatePortfolioTotals([],[{invested:100,participationValue:0},{invested:100,participationValue:-20},{invested:100,participationValue:null}]);
  assert.equal(result.estimatedTotal,-20);assert.equal(result.registeredAppreciation,-220);assert.equal(result.valuationCoverage.alliancesIncluded,2);
});

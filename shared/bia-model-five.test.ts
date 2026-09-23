import test from "node:test";
import assert from "node:assert/strict";
import { calculateInitialMap, calculateMap, initialMapEconomicSummary, economicStructureDocumentLines, type InitialMapParticipantInput, type InitialEconomicStructure } from "./member-portfolio";
import { commitmentsFromMap, validateInitialClassifications } from "./initial-contributions";

export const structure: InitialEconomicStructure = {modalidade:"consorcio",totalCotas:10,instrumentos:[{nome:"Carta 1",valor:1000000,cotas:5},{nome:"Carta 2",valor:1000000,cotas:5}],integralizacao:{forma:"parcelado",quantidade:240,primeiroVencimento:"2026-10-20",meses:1,correcao:"IGP-M"}};
export const participants: InitialMapParticipantInput[] = [ ["Juliana",1.5,1.25], ["Rafael",1.5,2], ["Eugenio",3,0], ["Mario",3,0], ["Rodrigo",1,1.25] ].map(([name,ci,index])=>({modeloCalculo:5,memberId:String(name),nome:String(name),tipo:"multiplicador",cotasInvestimento:Number(ci),cargos:[],indiceContribuicao:999,pesoCapital:999,capitalComprometido:999,naturezaCapital:"caixa",tipoCppCapital:{id:"capital",nome:"CPP Capital"},contribuicoes:[{cargo:"Contribuição individual",indice:Number(index),tipoCpp:{id:name==="Rodrigo"?"origem":"lideranca",nome:name==="Rodrigo"?"CPP Origem":"CPP Liderança"}}]}));

test("modelo 5 reproduz o documento: CIs, direitos separados, CPPs fecham 100% sem inflar VO",()=>{
  const map=calculateInitialMap(2000000,participants,structure);
  validateInitialClassifications(map.participantes);
  assert.equal(map.divisorMultiplicador,4.5);
  assert.equal(map.baseEconomicaInicial,2000000);
  assert.deepEqual(map.participantes.map(p=>p.mapPercentual),[15.575,16.325,28.65,28.65,10.8]);
  assert.deepEqual(map.participantes.map(p=>p.capitalComprometido),[300000,300000,600000,600000,200000]);
  assert.equal(map.participantes.reduce((s,p)=>s+p.cppTotal,0),2000000);
  assert.equal(map.participantes.reduce((s,p)=>s+p.cppOrigem,0),90000);
  assert.equal(initialMapEconomicSummary(map).custoDireitos,0);
  assert.match(economicStructureDocumentLines(map,"BRL").join("\n"),/15,57500%/);
  const commitments=commitmentsFromMap(2000000,map.participantes);
  assert.equal(commitments.filter(c=>c.componente==="capital").reduce((s,c)=>s+c.valor,0),2000000);
  assert.equal(commitments.find(c=>c.chave==="member:Rodrigo:capital")?.valor,200000);
  const base=map.participantes.map(p=>({memberId:p.memberId!,value:p.cppTotal}));
  const initial=calculateMap([{memberId:"Juliana",value:300000,status:"pago",finalidade:"integralizacao_inicial"}],[],base);
  assert.equal(initial.find(p=>p.memberId==="Juliana")?.percent,15.575);
  const additional=calculateMap([{memberId:"Juliana",value:100000,status:"pago",finalidade:"aporte_adicional"}],[],base);
  assert.equal(additional.reduce((s,p)=>s+p.value,0),2100000);
});

test("modelo 5 conserva resíduos e soma cargos sem duplicar capital",()=>{
  const people=participants.slice(0,3).map((p,i)=>({...p,cotasInvestimento:1,cargos:[`Cargo ${i}`],contribuicoes:[{cargo:"Contribuição individual",indice:i===0?1.25:0},{cargo:`Cargo ${i}`,indice:i===0?2:0}]}));
  const map=calculateInitialMap(100,people,{...structure,modalidade:"recursos_proprios",totalCotas:3,instrumentos:[]});
  assert.equal(map.divisorMultiplicador,3.25);
  assert.equal(map.participantes[0].indiceContribuicao,3.25);
  assert.equal(Number(map.participantes.reduce((s,p)=>s+p.capitalComprometido!,0).toFixed(5)),100);
  assert.equal(Number(map.participantes.reduce((s,p)=>s+p.cppTotal,0).toFixed(5)),100);
  const reread=calculateInitialMap(100,JSON.parse(JSON.stringify(map.participantes)),map.estrutura);
  assert.deepEqual(reread,map);
});
test("modelo 5 não mistura versões, aceita zero e rejeita CI ausente e distribuição inconsistente",()=>{
  assert.throws(()=>calculateInitialMap(2000000,participants.map((p,i)=>i===0?{...p,modeloCalculo:4}:p),structure),/versões/);
  assert.throws(()=>calculateInitialMap(2000000,participants.map((p,i)=>i===0?{...p,cotasInvestimento:undefined}:p),structure),/CIs/);
  assert.throws(()=>calculateInitialMap(2000000,participants,{...structure,totalCotas:9}),/instrumentos/);
  assert.throws(()=>calculateInitialMap(2000000,participants,{...structure,integralizacao:{...structure.integralizacao,primeiroVencimento:"2026-02-30"}}),/vencimento/);
  assert.throws(()=>calculateInitialMap(2000000,participants.map(p=>({...p,contribuicoes:[{cargo:"Contribuição individual",indice:30}]})),structure),/100%/);
  const p=participants.map(p=>({...p,contribuicoes:[{cargo:"Contribuição individual",indice:0}]}));
  assert.equal(calculateInitialMap(2000000,p,structure).divisorMultiplicador,0);
});

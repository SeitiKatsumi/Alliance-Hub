import test from "node:test";
import assert from "node:assert/strict";
import { calculateInitialMap, type InitialMapParticipantInput } from "./member-portfolio";
import { commitmentsFromMap, validateInitialClassifications } from "./initial-contributions";
import { biaAllowsFinance, nextBiaPhase } from "./bia-phase";
import { formatBiaPercent, parseBiaNumber } from "./bia-numbers";

const cpp = {id:"cpp",nome:"Liderança"};
const participant = (): InitialMapParticipantInput => ({modeloCalculo:4,memberId:"maria",nome:"Maria",tipo:"multiplicador",cargos:["Diretora de Aliança","Diretora de Capital"],indiceContribuicao:999,pesoCapital:0,capitalComprometido:1500000,naturezaCapital:"caixa",tipoCppCapital:cpp,contribuicoes:[{cargo:"Diretora de Aliança",indice:1.25,tipoCpp:cpp},{cargo:"Diretora de Capital",indice:2,tipoCpp:cpp}]});
test("modelo 4 soma cargos, ignora total enviado e conta capital do multiplicador uma vez",()=>{
  const map = calculateInitialMap(1500000,[participant()]);
  assert.equal(map.divisorMultiplicador,3.25);
  assert.equal(map.baseEconomicaInicial,1548750);
  assert.equal(map.participantes[0].cppCapital,1500000);
  assert.equal(map.participantes[0].mapPercentual,100);
  validateInitialClassifications(map.participantes);
  assert.equal(commitmentsFromMap(map.valorOrigem,map.participantes).filter(c=>c.componente === "contribuicao").length,2);
});
test("modelo anterior não aceita capital de multiplicador nem é convertido",()=>{
  const p = participant(); delete p.modeloCalculo; delete p.contribuicoes;
  assert.throws(()=>calculateInitialMap(1500000,[p]),/Multiplicador/);
});

test("nove participantes da planilha fecham 1,5 milhão, DM 12,5% e BEI 1.687.500",()=>{
  const names=["Maria","Ju","Rê","Mel","Pat","Max","Fabi","Rodrigo","Pedro"];
  const capital=[187500,275000,187500,187500,187500,187500,287500,0,0];
  const indices=[1.25,2,2,2,2,0,0,1.25,2];
  const people=names.map((nome,i)=>({...participant(),memberId:nome,nome,tipo:(i<7?"guardiao":"multiplicador") as "guardiao"|"multiplicador",capitalComprometido:capital[i],cargos:[],contribuicoes:[{cargo:"Contribuição individual",indice:indices[i],tipoCpp:cpp}],tipoCppCapital:{id:i===0?"propriedade":"capital",nome:i===0?"CPP Propriedade":"CPP Capital"}}));
  const map=calculateInitialMap(1500000,people);
  assert.equal(map.participantes.length,9);assert.equal(map.divisorMultiplicador,12.5);assert.equal(map.baseEconomicaInicial,1687500);
  assert.equal(map.participantes.find(p=>p.nome==="Ju")!.cppTotal,305000);
  assert.equal(commitmentsFromMap(1500000,map.participantes).find(c=>c.participanteId===map.participantes.find(p=>p.nome==="Ju")!.participantId && c.componente==="capital")?.valor,275000);
});
test("cargo duplicado, índice ausente e CPP ausente são recusados",()=>{
  const p=participant(); p.contribuicoes!.push(p.contribuicoes![0]);
  assert.throws(()=>calculateInitialMap(1500000,[p]),/Cada cargo/);
  p.contribuicoes=participant().contribuicoes; p.contribuicoes![0].indice=NaN;
  assert.throws(()=>calculateInitialMap(1500000,[p]),/DM/);
  p.contribuicoes![0].indice=0; delete p.contribuicoes![1].tipoCpp;
  assert.throws(()=>validateInitialClassifications(calculateInitialMap(1500000,[p]).participantes),/CPP/);
});
test("fases não pulam requisitos; execução não depende de imóvel; recebimento não é evento de distribuição",()=>{
  assert.equal(nextBiaPhase("em_captacao","aceites_concluidos",true),"em_execucao");
  assert.ok(biaAllowsFinance("em_execucao")); assert.ok(!biaAllowsFinance("em_captacao"));
  assert.throws(()=>nextBiaPhase("em_captacao","imovel_associado",true));
  assert.throws(()=>nextBiaPhase("em_operacao","resultado_aprovado",false));
  assert.equal(nextBiaPhase("em_estruturacao","encerramento",true),"encerrada");
});
test("formatação brasileira mantém zero e cinco casas",()=>{
  assert.equal(formatBiaPercent(1.25),"1,25000%"); assert.equal(parseBiaNumber("1.500.000,00"),1500000);
  assert.equal(parseBiaNumber("0,00000%"),0); assert.ok(Number.isNaN(parseBiaNumber("")));
});

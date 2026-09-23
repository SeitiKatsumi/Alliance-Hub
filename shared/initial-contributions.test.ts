import test from "node:test";
import assert from "node:assert/strict";
import { calculateInitialMap, calculateMap } from "./member-portfolio";
import { buildNominalSchedule, commitmentsFromMap, copyParticipantSchedule, isCashEntry, validateCommitments, economicRightName, withAutomaticEconomicRights, validateInitialClassifications } from "./initial-contributions";
import { BIA_PARTICIPANT_ROLE_LABELS as roles } from "./bia-access";
import type { InitialMapParticipantInput } from "./member-portfolio";

test("direitos automáticos: cargos, forma do aporte, tipos oficiais e preservação dos valores/histórico",()=>{
  const types=[{id:1,Nome:"CPP Origem"},{id:2,Nome:"CPP de Liderança"},{id:3,Nome:"Capital"},{id:4,Nome:"Propriedade"}];
  const cargos=[roles.autor,roles.aliado,roles.diretor_alianca,roles.diretor_tecnico,roles.diretor_obra,roles.diretor_comercial,roles.diretor_capital,"Contribuição individual"];
  assert.deepEqual(cargos.map(c=>economicRightName(c,"caixa")),["Origem","Origem","Liderança","Liderança","Liderança","Liderança","Liderança","Capital"]);
  const input:InitialMapParticipantInput[]=[{nome:"Pessoa",tipo:"multiplicador",modeloCalculo:5,indiceContribuicao:2,pesoCapital:100,capitalComprometido:123,cotasInvestimento:2,naturezaCapital:"caixa",tipoCppCapital:{id:"kept",nome:"Natureza do aporte"},contribuicoes:cargos.map((cargo,i)=>({cargo,indice:i===0?0:1.25,tipoCpp:{id:"wrong",nome:"Errado"}}))}];
  const original=JSON.stringify(input);
  const result=withAutomaticEconomicRights(input,types);
  assert.deepEqual(result[0].contribuicoes?.map(c=>c.tipoCpp?.id),["1","1","2","2","2","2","2",undefined]);
  assert.equal(JSON.stringify(input),original,"snapshots recebidos não são mutados");
  assert.equal(result[0].capitalComprometido,123);assert.equal(result[0].cotasInvestimento,2);
  assert.equal(result[0].tipoCppCapital,input[0].tipoCppCapital);
  assert.deepEqual(result[0].contribuicoes?.map(c=>c.indice),[0,1.25,1.25,1.25,1.25,1.25,1.25,0]);
  assert.equal(withAutomaticEconomicRights(result,types),result,"normalização é idempotente");
  const property=withAutomaticEconomicRights([{...result[0],tipo:"guardiao",naturezaCapital:"nao_caixa"}],types);
  assert.equal(property[0].contribuicoes?.at(-1)?.tipoCpp,undefined);
  const previousModel=withAutomaticEconomicRights([{...input[0],modeloCalculo:4}],types);
  assert.equal(previousModel[0].contribuicoes?.at(-1)?.tipoCpp?.id,"3","modelo anterior preserva o direito individual");
  assert.equal(previousModel[0].contribuicoes?.at(-1)?.indice,1.25);
  assert.equal(economicRightName("Contribuição individual"),undefined);
  assert.equal(economicRightName("Cargo inválido","caixa"),undefined);
  const missing=withAutomaticEconomicRights(input,[]);
  assert.ok(missing[0].contribuicoes?.every(c=>!c.tipoCpp));
  assert.throws(()=>validateInitialClassifications(missing as any),/tipos de CPP/);
});

test("direitos automáticos: índice vazio não dispara atualizações repetidas nem apaga a digitação",()=>{
  const types=[{id:"origin",Nome:"CPP Origem"}];
  const input:InitialMapParticipantInput[]=[{nome:"Pessoa",tipo:"multiplicador",modeloCalculo:5,indiceContribuicao:NaN,pesoCapital:0,contribuicoes:[{cargo:roles.autor,indice:2},{cargo:roles.aliado,indice:NaN}]}];
  const normalized=withAutomaticEconomicRights(input,types);
  assert.equal(withAutomaticEconomicRights(normalized,types),normalized,"NaN significa campo vazio, não uma mudança a cada render");
  assert.ok(Number.isNaN(normalized[0].contribuicoes![1].indice),"ausente não vira zero");
  for(const indice of [1,1.25,2.35897,0,NaN]) {
    const edited=normalized.map(p=>({...p,contribuicoes:p.contribuicoes!.map((c,i)=>i===1?{...c,indice}:c)}));
    assert.equal(withAutomaticEconomicRights(edited,types),edited,"digitar ou limpar não recria o formulário");
    assert.equal(edited[0].contribuicoes![0].indice,2,"outra função permanece intacta");
  }
});

test("planilha nova: nove pessoas, valores exatos e CPPs capturadas na estruturação",()=>{
  const names=["Maria","Ju","Rê","Mel","Pat","Max","Fabi","Rodrigo","Pedro"];
  const capital=[187500,275000,187500,187500,187500,187500,287500,0,0];
  const indices=[1.25,2,2,2,2,0,0,1.25,2];
  const inputs=names.map((nome,i)=>({participantId:`member:${i}`,memberId:String(i),nome,cargos:i===0?["Diretora","Guardiã"]:[],tipo:i<7?"guardiao" as const:"multiplicador" as const,pesoCapital:0,capitalComprometido:capital[i],indiceContribuicao:indices[i],naturezaCapital:i===0?"nao_caixa" as const:"caixa" as const,tipoCppCapital:{id:i===0?"property":"capital",nome:i===0?"CPP Propriedade":"CPP Capital"},tipoCppContribuicao:{id:i<7?"lead":"origin",nome:i<7?"CPP Liderança":"CPP Origem"}}));
  const result=calculateInitialMap(1500000,inputs);
  assert.equal(result.divisorMultiplicador,12.5);assert.equal(result.baseEconomicaInicial,1687500);
  assert.deepEqual(result.participantes.map(p=>p.cppTotal),[206250,305000,217500,217500,217500,187500,287500,18750,30000]);
  assert.deepEqual(result.participantes.map(p=>p.cppCapital),capital);
  assert.equal(result.participantes[2].tipoCppCapital?.nome,"CPP Capital");
  assert.equal(result.participantes[7].tipoCppContribuicao?.nome,"CPP Origem");
  assert.equal(Math.round(result.participantes.reduce((s,p)=>s+p.mapPercentual,0)*100000),10000000);
  assert.throws(()=>calculateInitialMap(1500000,[...inputs,{...inputs[0],participantId:"spoof"}]),/mesma pessoa/);
  assert.throws(()=>calculateInitialMap(1500000,inputs.map((p,i)=>i===7?{...p,capitalComprometido:1}:p)),/Multiplicador/);
  assert.throws(()=>calculateInitialMap(1500000,inputs.map((p,i)=>i===0?{...p,capitalComprometido:187499}:p)),/100/);
  const commitments=commitmentsFromMap(1500000,result.participantes);
  assert.equal(commitments.find(c=>c.chave==="member:1:capital")?.valor,275000);
  assert.equal(commitments.find(c=>c.chave==="member:1:contribuicao")?.valor,30000);
  assert.equal(commitments.find(c=>c.chave==="member:0:capital")?.natureza,"nao_caixa");
  const tiny=calculateInitialMap(1500000,[{...inputs[0],capitalComprometido:0.00001},{...inputs[1],capitalComprometido:1499999.99999}]);
  assert.equal(tiny.participantes[0].cppCapital,0.00001,"Peso arredondado não pode apagar o valor exato");
  assert.throws(()=>calculateInitialMap(1500000,inputs.map((p,i)=>i===0?{...p,capitalComprometido:undefined}:p)),/capital comprometido/);
});

test("cronograma nominal conserva centavos, fecha séries mistas e respeita calendário",()=>{
  const rows=buildNominalSchedule(1500000,[{total:400000,quantidade:1,primeiroVencimento:"2026-09-18",meses:0},{total:960000,quantidade:120,primeiroVencimento:"2026-09-30",meses:1},{total:140000,quantidade:9,primeiroVencimento:"2027-09-30",meses:12}]);
  assert.equal(rows.length,130);assert.equal(rows.reduce((s,p)=>s+Math.round(p.valor*100),0),150000000);
  const ju=buildNominalSchedule(275000,[{total:275000,quantidade:120,primeiroVencimento:"2027-01-31",meses:1}]);
  assert.equal(ju[0].valor,2291.67);assert.equal(ju[119].valor,2291.27);
  const inherited=copyParticipantSchedule(30000,275000,[{total:275000,quantidade:120,primeiroVencimento:"2027-01-31",meses:1}]);
  assert.equal(buildNominalSchedule(30000,inherited)[0].valor,250);
  assert.equal(inherited[0].primeiroVencimento,"2027-01-31");
  assert.equal(ju[1].vencimento,"2027-02-28");assert.equal(ju[2].vencimento,"2027-03-31");
  assert.equal(buildNominalSchedule(2,[{total:2,quantidade:2,primeiroVencimento:"2028-01-31",meses:1}])[1].vencimento,"2028-02-29");
  assert.throws(()=>buildNominalSchedule(100,[{total:100,quantidade:1,primeiroVencimento:"",meses:12}]),/vencimento/);
  assert.throws(()=>buildNominalSchedule(100,[{total:100,quantidade:1,primeiroVencimento:"2026-02-30",meses:1}]),/inválido/);
  assert.throws(()=>buildNominalSchedule(100,[{total:99,quantidade:1,primeiroVencimento:"2026-09-18",meses:1}]),/soma/);
});

test("integralizar não duplica CPP, não caixa não soma dinheiro e adicionais pagos alteram MAP",()=>{
  const base=[{memberId:"ju",value:305000}];
  const initial={memberId:"ju",value:2291.67,status:"pago",finalidade:"integralizacao_inicial"};
  assert.equal(calculateMap([initial],[],base)[0].value,305000);
  assert.equal(calculateMap([{...initial,status:"agendado"}],[],base)[0].value,305000);
  assert.equal(calculateMap([{memberId:"ju",value:1000,status:"pago"}],[],base)[0].value,306000);
  assert.equal(calculateMap([{memberId:"ju",value:1000,status:"pendente"}],[],base)[0].value,305000);
  assert.equal(isCashEntry({natureza:"nao_caixa"}),false);assert.equal(isCashEntry({conciliacao_pendente:true}),false);
  assert.throws(()=>validateCommitments([{chave:"ativo"} as any],[]),/revisão vigente/);
});

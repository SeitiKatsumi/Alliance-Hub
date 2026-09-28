import test from 'node:test';
import assert from 'node:assert/strict';
import {biaBudgetSchema,emptyBiaBudget,projectBiaBudget,type BiaBudget} from './bia-budget';
import {emptyBiaSetup,parseBiaSetup,legacyBiaSetup,legalBlockers} from './bia-setup';
import {validateBiaDraft} from '../server/bia-workflow';

function budget():BiaBudget {
  return {...emptyBiaBudget('BRL'),inicio:'2026-10',meses:12,
    capex:[{id:'c',descricao:'Aquisição',valor:1250000,situacao:'Estimativa',ativoId:'',ativoNome:'',pagamentos:[{id:'1',mes:'2026-10',valor:900000},{id:'2',mes:'2026-11',valor:250000},{id:'3',mes:'2026-12',valor:100000}]}],
    opex:[{id:'o',descricao:'Contabilidade',valorMensal:4500,inicio:'2026-10',fim:'',situacao:'Estimativa',ativoId:'',ativoNome:''}],
    fontes:[{id:'f',descricao:'Recursos próprios',tipo:'Aporte',valor:1304000,mes:'2026-10',situacao:'Confirmada pelo responsável',destinacao:'Livre',observacoes:''}]};
}
test('orçamento projeta parcelas, meses inclusivos, centavos e dois cenários sem usar VO como caixa',()=>{
  const b=budget(),before=structuredClone(b),p=projectBiaBudget(b,'BRL',[],1000000);
  assert.equal(p.capex,1250000);assert.equal(p.opex,54000);assert.equal(p.diferenca,250000);assert.equal(p.rows.length,12);
  assert.equal(p.rows[0].descobertoConfirmado,0);assert.equal(p.rows[11].descobertoConfirmado,0);assert.deepEqual(b,before);
  b.fontes[0].situacao='Condicionada';const conditional=projectBiaBudget(b,'BRL',[],1000000);
  assert.equal(conditional.rows[0].descobertoConfirmado,904500);assert.equal(conditional.rows[0].descobertoPrevisto,0);
  b.opex[0].valorMensal=0.1;b.opex[0].inicio='2026-12';b.opex[0].fim='2027-02';assert.equal(projectBiaBudget(b,'BRL').opex,0.3);
});
test('recursos restritos e cobertura acumulada não escondem necessidade em outra categoria',()=>{
  const b=budget();b.fontes[0].destinacao='CAPEX';
  const p=projectBiaBudget(b,'BRL');assert.equal(p.rows[0].descobertoConfirmado,4500);assert.equal(p.rows[11].descobertoPrevisto,54000);
  b.fontes.push({...b.fontes[0],id:'f2',valor:54000,mes:'2026-11',destinacao:'OPEX'});
  const q=projectBiaBudget(b,'BRL');assert.equal(q.rows[0].descobertoConfirmado,4500);assert.equal(q.rows[1].descobertoConfirmado,0);assert.equal(q.rows[11].descobertoConfirmado,0);
});
test('ausência, zero, divergência de parcela, moeda, horizonte, duplicidade e ativo removido são explícitos',()=>{
  assert.equal(projectBiaBudget(undefined,'BRL').capex,null);
  const b=budget();b.capex[0].valor=0;b.capex[0].pagamentos=[{id:'p',mes:'2026-10',valor:0}];
  assert.equal(projectBiaBudget(b,'BRL').capex,0);
  b.capex[0].valor=null;assert.equal(projectBiaBudget(b,'BRL').capex,null);
  b.capex[0].valor=10;assert.match(projectBiaBudget(b,'BRL').warnings.join(' '),/Pagamentos diferem/);
  const fx=projectBiaBudget(b,'USD',[],1);assert.equal(fx.diferenca,null);assert.equal(fx.rows[0].descobertoConfirmado,null);
  b.capex[0].pagamentos[0].mes='2028-10';assert.match(projectBiaBudget(b,'BRL').warnings.join(' '),/fora do horizonte/);
  b.capex[0].pagamentos[0].mes='2026-10';b.capex[0].descricao='Contabilidade';assert.match(projectBiaBudget(b,'BRL').warnings.join(' '),/duplicidade/);
  b.capex[0].ativoId='removed';b.capex[0].ativoNome='Ativo anterior';assert.match(projectBiaBudget(b,'BRL').warnings.join(' '),/Ativo anterior/);
  b.capex[0].valor=-1;assert.equal(projectBiaBudget(b,'BRL').rows.length,0);assert.throws(()=>biaBudgetSchema.parse(b));
});
test('rascunho, legado e clientes antigos preservam orçamento sem mudar bloqueios ou criar dados ao abrir',()=>{
  const old=emptyBiaSetup(),current={...old,orcamento:budget()},before=structuredClone(current);
  assert.equal(legacyBiaSetup({}).orcamento,undefined);
  assert.deepEqual(parseBiaSetup(old,current).orcamento,current.orcamento);
  assert.deepEqual(validateBiaDraft({nome_bia:'Exemplo',moeda:'BRL',estrutura_bia:current}).estrutura_bia,current);
  assert.deepEqual(legalBlockers(old),legalBlockers(current));assert.deepEqual(current,before);
  const b=budget();b.capex.push({...b.capex[0]});assert.throws(()=>biaBudgetSchema.parse(b));
  const malformed=budget();malformed.opex[0].fim='2026-09';assert.throws(()=>biaBudgetSchema.parse(malformed));
  malformed.opex[0].fim='2027-13';assert.throws(()=>biaBudgetSchema.parse(malformed));
  const oversized=budget();oversized.meses=120;oversized.opex=Array.from({length:200},(_,i)=>({...oversized.opex[0],id:String(i),valorMensal:1e10}));assert.throws(()=>biaBudgetSchema.parse(oversized),/cálculo seguro/);
});

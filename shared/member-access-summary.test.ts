import test from 'node:test';
import assert from 'node:assert/strict';
import {memberAccessSummary} from './member-access-summary';
const base={user:{id:'u',membro_directus_id:'m',role:'user',ativo:true},member:{},biases:[],overrides:[],entitlement:false,employee:null,bootstrap:false};
test('relatório de conta comum mostra apenas os ambientes ativos',()=>{
 const result=memberAccessSummary(base);
 assert.equal(result.roleLabel,'Usuário comum');
 assert.deepEqual(result.environments.map(e=>[e.key,e.allowed]),[['vitrine',true],['alliances',false]]);
 assert.deepEqual(memberAccessSummary({...base,user:{...base.user,role:'investidor'},member:{em_built_capital:true,Outras_redes_as_quais_pertenco:['BUILT_CAPITAL_PARTNER']}}).profiles,[]);
 assert.equal(result.entitlement,false);
});
test('multiple contextual roles use the official matrix and do not leak another BIA',()=>{
 const result=memberAccessSummary({...base,biases:[{id:'b',nome_bia:'Teste',diretor_capital:'m',socios_guardioes:['m']},{id:'other',diretor_alianca:'other'}]});
 assert.equal(result.alliances.length,1);
 assert.equal(result.alliances[0].permissions.capital_financeiro,'edit');
 assert.equal(result.alliances[0].permissions.configuracao_bia,'none');
 assert.equal(result.alliances[0].roleLabels.length,2);
 assert.equal(result.environments[1].allowed,true);
});
test('custom grants preserve role floors and administrator bypass is explicit',()=>{
 const biases=[{id:'b',diretor_alianca:'m'}];
 const result=memberAccessSummary({...base,biases,overrides:[{bia_id:'b',permissions:{capital_financeiro:'edit'}}]});
 assert.equal(result.alliances[0].permissions.diretoria,'edit');
 assert.equal(result.alliances[0].permissions.capital_financeiro,'edit');
 assert.equal(result.alliances[0].permissions.capital_banco,'view');
 const admin=memberAccessSummary({...base,biases,bootstrap:true});
 assert.equal(admin.alliances[0].editable,false);
 assert.equal(admin.alliances[0].permissions.documentos_obra,'edit');
});

test('relatório de acessos propaga edição financeira dos três cargos com overrides antigos',()=>{
 for(const field of ['diretor_capital','diretor_alianca','aliado_built']) {
  const result=memberAccessSummary({...base,biases:[{id:'b',[field]:'m'},{id:'s',socios_guardioes:['m']}],overrides:[{bia_id:'b',permissions:{capital_financeiro:'none'}}]});
  assert.equal(result.alliances[0].permissions.capital_financeiro,'edit');
  assert.equal(result.alliances[0].defaults.capital_financeiro,'edit');
  assert.equal(result.alliances[0].permissions.capital_banco,'view');
  assert.equal(result.alliances[1].permissions.capital_financeiro,'view');
  assert.equal(result.admin,false);
 }
});

test('membership is independent of administrator and paid subscription',()=>{
 const admin={...base,user:{...base.user,role:'admin'}};
 assert.deepEqual(memberAccessSummary(admin).profiles,[]);
 assert.deepEqual(memberAccessSummary({...admin,member:{em_membros_built:true}}).profiles,['membro']);
 const paid=memberAccessSummary({...base,entitlement:true});assert.deepEqual(paid.profiles,[]);assert.equal(paid.entitlement,true);
});

test('coproprietário mostra somente ambientes compartilhados, sem prometer Vitrine ou Capital',()=>{
 const result=memberAccessSummary({...base,user:{...base.user,role:'coproprietario'}});
 assert.deepEqual(result.environments.map(item=>item.label),['Imóveis compartilhados','Alianças compartilhadas']);
 assert.equal(result.admin,false);
 assert.deepEqual(result.alliances,[]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { participantEntries, participantContributionAreas, type ParticipantEntry } from './bia-participant-detail';

const entry = (id: string, patch: Partial<ParticipantEntry> = {}): ParticipantEntry => ({ id, bia:'bia-a', tipo:'entrada', valor:10, descricao:'Homônimo', Favorecido:['person-a'], ...patch });
test('participação financeira exige IDs da BIA e da pessoa, preserva ambos os vínculos sem duplicar', () => {
  const rows = participantEntries([
    entry('both', { membro_responsavel:{id:'person-a'}, Favorecido:[{id:'person-a'}] }),
    entry('recorder', { Favorecido:['person-b'], membro_responsavel:'person-a', tipo:'saida' }),
    entry('other-bia', { bia:{id:'bia-b'} }), entry('homonym', { Favorecido:[{id:'person-b', nome:'Homônimo'}] }),
    entry('expanded', { bia:{id:'bia-a'}, Favorecido:[{cadastro_geral_id:{id:'person-a'}}] }),
    entry('both'),
  ], 'bia-a', 'person-a');
  assert.deepEqual(rows.map(row => row.id).sort(), ['both','expanded','recorder']);
  assert.equal(rows.find(row => row.id === 'recorder')?.beneficiary, false);
  assert.equal(rows.find(row => row.id === 'recorder')?.responsible, true);
  const both = participantEntries([entry('both', {membro_responsavel:'person-a'})], 'bia-a','person-a')[0];
  assert.equal(both.beneficiary && both.responsible, true);
  assert.deepEqual(participantEntries([entry('a')], '', 'person-a'), []);
  assert.deepEqual(participantEntries([entry('a')], 'bia-a', ''), []);
});
test('lista conserva pagos, parciais, cancelados e não caixa sem tratá-los como aporte pago', () => {
  const rows = participantEntries([entry('paid', {status:'pago'}), entry('partial', {status:'parcial'}), entry('canceled', {status:'cancelado'}), entry('rights', {natureza:'nao_caixa',conciliacao_pendente:true})], 'bia-a','person-a');
  assert.equal(rows.length,4);
  assert.equal(rows.find(row => row.id === 'rights')?.conciliacao_pendente,true);
  assert.equal(rows.find(row => row.id === 'partial')?.status,'parcial');
});
test('áreas reutilizam catálogo do perfil, seleções modernas vazias vencem legado', () => {
  const types=['Alianças de Aporte Financeiro'];
  const fromArray=participantContributionAreas({id:'a',tipos_alianca:types});
  assert.ok(fromArray.length);
  assert.deepEqual(participantContributionAreas({id:'a',tipos_alianca:JSON.stringify(types)}),fromArray);
  assert.deepEqual(participantContributionAreas({id:'a',tipos_alianca:[],tipo_alianca:types[0]}),[]);
  assert.deepEqual(participantContributionAreas({id:'a',tipos_alianca:['unknown']}),[]);
});

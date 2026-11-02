import test from 'node:test';
import assert from 'node:assert/strict';
import {QueryClient} from '@tanstack/react-query';
import {accessSessionKey,resetAccessQueries} from './access-session';
import {ACCOUNT_ACCESS_PRESETS,accountAccessPreset,normalizeAccountRole} from '../../../shared/account-access-profiles';
import {createUserSchema,updateUserSchema} from '../../../shared/schema';
import {canAccessBuiltEnvironment} from '../../../shared/environment-access';

test('perfis de teste cobrem cargos persistidos e Superadmin usa admin compatível com as telas',()=>{
  assert.deepEqual(new Set(ACCOUNT_ACCESS_PRESETS.map(p=>p.role)),new Set(createUserSchema.shape.role.removeDefault().options));
  for(const preset of ACCOUNT_ACCESS_PRESETS) assert.equal(updateUserSchema.parse({role:preset.role}).role,preset.role);
  assert.equal(accountAccessPreset('admin')?.label,'Superadmin · Administração');
  assert.equal(accountAccessPreset('professional')?.role,'user');
  assert.equal(accountAccessPreset('employee'),undefined);
  assert.equal(normalizeAccountRole('superadmin'),'admin');assert.equal(normalizeAccountRole('master'),'admin');
  assert.equal(canAccessBuiltEnvironment({role:accountAccessPreset('membro')?.role},'alliances'),true);
  assert.equal(canAccessBuiltEnvironment({role:accountAccessPreset('investidor')?.role},'capital'),true);
  assert.equal(canAccessBuiltEnvironment({role:accountAccessPreset('user')?.role},'alliances'),false);
});

test('sessão distingue alterações de acesso e ignora ordem e mudanças apenas no nome',()=>{
  const base={id:'u',role:'user',permissions:{bias:'view',admin:'none'},account_purposes:['profissional','imovel'],nome:'A'};
  assert.equal(accessSessionKey(base),accessSessionKey({...base,nome:'B',permissions:{admin:'none',bias:'view'},account_purposes:['imovel','profissional']}));
  for(const change of [{role:'admin'},{permissions:{}},{em_membros_built:true},{access_revision:'new-bia-role'},{company_permissions:{capital:'none'}},{account_purposes:[]}]) assert.notEqual(accessSessionKey(base),accessSessionKey({...base,...change}));
});

test('troca de acesso limpa dados antigos sem apagar a nova identidade autenticada',async()=>{
  const cache=new QueryClient({defaultOptions:{queries:{retry:false}}});
  cache.setQueryData(['/api/me'],{id:'u',role:'user'});
  cache.setQueryData(['/api/admin/monetization'],{private:'old-admin-data'});
  cache.setQueryData(['/api/bias','b','access-control'],{capital_financeiro:'edit'});
  await resetAccessQueries(cache);
  assert.deepEqual(cache.getQueryData(['/api/me']),{id:'u',role:'user'});
  assert.equal(cache.getQueryData(['/api/admin/monetization']),undefined);
  assert.equal(cache.getQueryData(['/api/bias','b','access-control']),undefined);
  cache.clear();
});

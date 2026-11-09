import test from 'node:test';
import assert from 'node:assert/strict';
import { PROFILE_ORDER, ACCOUNT_AREA_KEYS, areaChoices, areaForPath, inheritsArea, withAreaChoices } from './account-areas';
import { permissionsForRole, MODULE_KEYS, updateUserSchema } from './schema';
import { canAccessBuiltEnvironment, canPublishVitrineProfile } from './environment-access';

test('a promoção mantém todas as áreas e capacidades disponíveis nos níveis anteriores', () => {
  const levels = ['none','view','edit'];
  for (let i = 1; i < PROFILE_ORDER.length; i++) {
    const before = PROFILE_ORDER[i-1], after = PROFILE_ORDER[i];
    for (const key of ACCOUNT_AREA_KEYS) if (inheritsArea(before,key)) assert.ok(inheritsArea(after,key));
    for (const key of MODULE_KEYS) assert.ok(levels.indexOf(permissionsForRole(after)[key]) >= levels.indexOf(permissionsForRole(before)[key]));
  }
  assert.equal(inheritsArea('manager','admin'),false);
});

test('exceções podem ser gravadas, removidas e distinguidas de vínculos da empresa', () => {
  const permissions = withAreaChoices({bias:'view'}, {alliances:'permit',publicar:'deny'});
  const reopened = updateUserSchema.parse({permissions}).permissions!;
  assert.deepEqual(areaChoices(reopened), {publicar:'deny',alliances:'permit'});
  assert.equal(canAccessBuiltEnvironment({role:'user',permissions:reopened},'alliances'),true);
  assert.equal(canAccessBuiltEnvironment({role:'user',permissions:reopened,company_employee:true},'alliances'),false);
  assert.equal(canPublishVitrineProfile({role:'admin',permissions:reopened}),false);
  assert.deepEqual(withAreaChoices(reopened,{}),{bias:'view'});
});

test('rotas da página e da API correspondem às respectivas áreas', () => {
  for (const path of ['/carteira/abc','/?tab=carteira&view=imoveis','/api/carteira/imoveis']) assert.equal(areaForPath(path),'carteira');
  for (const path of ['/area-aliancas','/comunidade/1','/api/bias/1/dossie','/api/comunidades','/banco-ativos']) assert.equal(areaForPath(path),'alliances');
  assert.equal(areaForPath('/api/users/123'),'admin');
  assert.equal(areaForPath('/api/agenda-alertas/resumo'),'agenda');
  assert.equal(areaForPath('/api/convites/token'),null);
  assert.equal(areaForPath('/api/me'),null);
});

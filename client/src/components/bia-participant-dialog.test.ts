import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('organograma só consulta finanças na abertura com permissão, sem endpoint de mutação', () => {
  const chart=readFileSync(new URL('./bia-organization-chart.tsx',import.meta.url),'utf8');
  const dialog=readFileSync(new URL('./bia-participant-dialog.tsx',import.meta.url),'utf8');
  const page=readFileSync(new URL('../pages/bia-detalhe.tsx',import.meta.url),'utf8');
  assert.match(chart,/selected && <BiaParticipantDialog/);
  assert.match(chart,/canViewFinancial = false/);
  assert.equal((page.match(/canViewFinancial=\{hasBiaAccess\(accessMatrix, 'capital_financeiro', 'view'\)\}/g)||[]).length,2);
  assert.equal((dialog.match(/enabled: canViewFinancial && !!biaId/g)||[]).length,2);
  assert.match(dialog,/!canViewFinancial \?/);
  assert.match(dialog,/participantEntries\(flows.data \|\| \[\], biaId, person.id\)/);
  assert.match(dialog,/row.memberId === person.id/);
  assert.match(dialog,/member \? <Button asChild>/);
  assert.match(dialog,/getMembroUrl\(member\)/);
  assert.doesNotMatch(dialog,/method:\s*['"](?:POST|PATCH|PUT|DELETE)/);
  const routes=readFileSync(new URL('../../../server/routes.ts',import.meta.url),'utf8');
  const get=routes.slice(routes.indexOf('app.get("/api/fluxo-caixa",'),routes.indexOf('app.get("/api/fluxo-caixa/:id/historico"'));
  assert.match(get,/requireBiaModuleAccess\(req, res, requestedBiaId, "capital_financeiro", "view"\)/);
});

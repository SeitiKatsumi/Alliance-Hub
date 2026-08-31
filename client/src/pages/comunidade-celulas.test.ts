import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Comunidade mantém as seis Células oficiais em uma aba própria", () => {
  const page = readFileSync(new URL("./comunidade-detalhe.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const routes = readFileSync(new URL("../../../server/routes.ts", import.meta.url), "utf8");

  assert.match(page, /role="tab"[\s\S]*selectCommunityTab\("celulas"\)/);
  assert.match(page, /activeCommunityTab === "celulas" \? "block" : "hidden"/);
  assert.doesNotMatch(page, /Propor (nova )?Célula/);
  assert.doesNotMatch(page, /cell\.markets\.map/);
  assert.doesNotMatch(page, />Tipos de negócio</);
  assert.doesNotMatch(page, />Coordenador da Célula</);
  assert.match(page, /navigate\(`\/comunidade\/\$\{id\}\/celulas\/\$\{cell\.id\}`\)/);
  assert.match(page, /data-testid="section-participantes-celula"/);
  assert.match(app, /Route path="\/comunidade\/:id\/celulas\/:cellId"/);
  assert.match(routes, /async function ensureCommunityStrategicCells/);
  assert.match(routes, /await ensureCommunityStrategicCells\(req\.params\.id\)/);
  assert.match(routes, /canManage \? cellMemberships : cellMemberships\.filter/);
});

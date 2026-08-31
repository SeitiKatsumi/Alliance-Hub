import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("ROs ficam dentro da Comunidade e saem da navegacao global", () => {
  const area = readFileSync(new URL("./area-aliancas.tsx", import.meta.url), "utf8");
  const community = readFileSync(new URL("./comunidade-detalhe.tsx", import.meta.url), "utf8");
  const opportunities = readFileSync(new URL("./network-opportunities.tsx", import.meta.url), "utf8");

  assert.match(area, /data-testid="tab-area-comunidades"[\s\S]*?Comunidades/);
  assert.doesNotMatch(area, /data-testid="tab-area-ros"/);
  assert.match(community, /selectCommunityTab\("ros"\)/);
  assert.match(community, /const search = useSearch\(\)/);
  assert.match(community, /new URLSearchParams\(search\)/);
  assert.match(community, /<NetworkOpportunitiesHub communityId=.*roOnly/);
  assert.match(opportunities, /!roOnly && <Tabs/);
  assert.doesNotMatch(opportunities, /<TabsTrigger[^>]*value="ros"/);
});

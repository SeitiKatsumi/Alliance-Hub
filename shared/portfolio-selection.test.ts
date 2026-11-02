import test from "node:test";
import assert from "node:assert/strict";
import { selectPortfolio } from "./portfolio-selection";
import { portfolioDashboard } from "./portfolio-dashboard";
import { portfolioHistoryScope } from "../server/portfolio-history";

test("recorte conserva valores e separa histórico individual do agregado", () => {
  const properties = [{id:"p1",valor_aquisicao_brl:100},{id:"p2",valor_aquisicao_brl:200}];
  const alliances = [{id:"b1",cpp_base_brl:50,cpp_contributed_brl:20,cpp_remaining_brl:30},{id:"b2",cpp_base_brl:100,cpp_contributed_brl:60,cpp_remaining_brl:40}];
  const selected=selectPortfolio(properties,alliances,"p2","b1");
  const metrics=portfolioDashboard(selected.imoveis,selected.aliancas);
  assert.equal(metrics.acquisition.value,200); assert.equal(metrics.cppContributed.value,20); assert.equal(metrics.cppRemaining.value,30);
  assert.notEqual(portfolioHistoryScope(properties,alliances),portfolioHistoryScope(selected.imoveis,selected.aliancas));
  assert.equal(selectPortfolio(properties,alliances).imoveis.length,2);
  assert.throws(()=>selectPortfolio(properties,alliances,"outro"),{status:404});
  assert.throws(()=>selectPortfolio(properties,alliances,"","outro"),{status:404});
  assert.throws(()=>selectPortfolio(properties,alliances,["p1"]),{status:400});
  assert.equal(properties.length,2);assert.equal(alliances.length,2);
});

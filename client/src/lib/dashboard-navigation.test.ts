import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dashboardNavigationUrl, resolveDashboardNavigation } from "./dashboard-navigation";

test("legacy convergence and OBA links open recommended businesses", () => {
  assert.deepEqual(resolveDashboardNavigation("?tab=convergencias"), {
    tab: "negocios",
    carteiraView: "imoveis",
    businessSection: "recomendados",
  });
  assert.equal(resolveDashboardNavigation("?tab=opas").tab, "negocios");
});

test("legacy portfolio opportunities open personal opportunities", () => {
  const navigation = resolveDashboardNavigation("?tab=carteira&view=oportunidades");
  assert.equal(navigation.tab, "negocios");
  assert.equal(navigation.businessSection, "minhas-oportunidades");
});

test("portfolio keeps only properties and BIAs", () => {
  assert.equal(resolveDashboardNavigation("?tab=carteira&view=bias").carteiraView, "bias");
  assert.equal(resolveDashboardNavigation("?tab=carteira&view=anything").carteiraView, "imoveis");
});

test("new dashboard URLs remain stable", () => {
  assert.equal(dashboardNavigationUrl({ tab: "negocios", carteiraView: "imoveis", businessSection: "andamento" }), "/?tab=negocios&section=andamento");
  assert.equal(dashboardNavigationUrl({ tab: "carteira", carteiraView: "imoveis", businessSection: "recomendados" }), "/?tab=carteira&view=imoveis");
  assert.equal(dashboardNavigationUrl({ tab: "carteira", carteiraView: "bias", businessSection: "recomendados" }), "/?tab=carteira&view=bias");
});

test("home keeps businesses in their dedicated tab", () => {
  const panel = readFileSync(new URL("../pages/painel.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(panel, /stat-card-negocios-foco|Negócios em foco/);
  assert.match(panel, /data-testid="tab-dashboard-negocios"/);
});

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { portfolioDashboard } from "../../../shared/portfolio-dashboard";

test("quatro indicadores e dois gráficos reais preservam faixa, perdas e observação única", () => {
  const source = readFileSync(new URL("./portfolio-patrimony-dashboard.tsx", import.meta.url), "utf8");
  const code = source.replace(/^import .*;\r?\n/gm, "").replace(/export function/g, "function");
  const Component = new Function("React", transformSync(code, { loader: "tsx" }).code + "; return PortfolioPatrimonyDashboard;")(React);
  const metrics = portfolioDashboard([{ id: "p", valor_aquisicao_brl: 100, estimativa_dashboard: { min: 200, max: 300, value: 250 } }], [{ id: "b", cpp_base_brl: 50, valor_participacao_brl: -10 }]);
  const render = (props = {}) => renderToStaticMarkup(React.createElement(Component, { metrics, observations: [{ day: "2026-10-22", observedAt: "2026-10-22T00:00:00Z", metrics }], ...props }));
  const html = render();
  assert.match(html, /aquisição dos imóveis próprios/); assert.match(html, /atualizado estimado das CPPs/); assert.match(html, /10 km/);
  assert.equal((html.match(/role="img"/g) || []).length, 2); assert.match(html, /Primeira observação/); assert.match(html, /-R\$/);
  assert.doesNotMatch(html, /<line x1="310"/); assert.match(render({ historyError: "Consulta indisponível" }), /role="alert"/);
  assert.match(render({ observations: [] }), /Sem observações/);
  const partial = render({ metrics: { ...metrics, propertyEstimate: { ...metrics.propertyEstimate, partial: true, included: 1, total: 2 } } });
  assert.match(partial, /class="sr-only">Parcial · 1 de 2 com dados/);
  assert.doesNotMatch(partial, /text-amber/);
  const indicative = render({ metrics: { ...metrics, propertyEstimate: { ...metrics.propertyEstimate, indicative: true } } });
  assert.match(indicative, /Faixa indicativa por IA/);
  assert.doesNotMatch(indicative, /Faixa por anúncios comparáveis em até 10 km/);
});

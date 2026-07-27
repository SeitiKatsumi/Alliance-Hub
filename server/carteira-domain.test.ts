import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCarteiraAlternativas,
  diagnosticarCarteira,
  hasCarteiraAccess,
} from "../shared/carteira";

test("hierarquia de acesso respeita leitura, colaboração, administração e proprietário", () => {
  assert.equal(hasCarteiraAccess("leitura", "leitura"), true);
  assert.equal(hasCarteiraAccess("leitura", "colaboracao"), false);
  assert.equal(hasCarteiraAccess("colaboracao", "leitura"), true);
  assert.equal(hasCarteiraAccess("colaboracao", "administracao"), false);
  assert.equal(hasCarteiraAccess("administracao", "colaboracao"), true);
  assert.equal(hasCarteiraAccess("proprietario", "administracao"), true);
});

test("imóvel vazio com despesas é classificado como ocioso e gerador de custos", () => {
  const result = diagnosticarCarteira({
    imovel: {
      ocupacao: "vazio",
      objetivo: "renda",
      area_m2: 120,
      valor_atual: 600000,
      valor_data_base: "2026-07-01",
    },
    lancamentos: [
      { tipo: "despesa", valor: 2500, status: "pago", data: "2026-07-01" },
    ],
    documentos: [],
    now: new Date("2026-07-24T12:00:00Z"),
  });

  assert.equal(result.situacao, "Ocioso");
  assert.ok(result.classificacoes.includes("Gerador de custos"));
  assert.equal(result.indicadores.resultado_liquido, -2500);
  assert.equal(result.proxima_acao, "Analisar alternativas");
});

test("resultado positivo ocupado é rentável e cancela lançamentos cancelados", () => {
  const result = diagnosticarCarteira({
    imovel: {
      ocupacao: "ocupado",
      objetivo: "renda",
      area_m2: 80,
      valor_atual: 400000,
      valor_data_base: "2026-07-01",
    },
    lancamentos: [
      { tipo: "receita", valor: 5000, status: "pago" },
      { tipo: "despesa", valor: 1200, status: "pago" },
      { tipo: "despesa", valor: 9000, status: "cancelado" },
    ],
    documentos: [
      { tipo: "Matrícula", validade: null, status_validacao: "validado" },
    ],
    now: new Date("2026-07-24T12:00:00Z"),
  });

  assert.equal(result.situacao, "Rentável estabilizado");
  assert.equal(result.indicadores.resultado_liquido, 3800);
  assert.equal(result.confianca, "alta");
});

test("confiança baixa informa dados faltantes sem inventar conclusão", () => {
  const result = diagnosticarCarteira({
    imovel: { nome: "Imóvel incompleto" },
    now: new Date("2026-07-24T12:00:00Z"),
  });

  assert.equal(result.confianca, "baixa");
  assert.equal(result.situacao, "Diagnóstico preliminar");
  assert.ok(result.dados_faltantes.includes("ocupação"));
  assert.ok(result.dados_faltantes.includes("documento atual"));
});

test("valores desconhecido e indefinido não aumentam artificialmente a cobertura", () => {
  const result = diagnosticarCarteira({
    imovel: {
      nome: "Imóvel legado",
      ocupacao: "desconhecido",
      objetivo: "indefinido",
      area_m2: 120,
      valor_atual: 500000,
      valor_data_base: "2026-07-01",
    },
    lancamentos: [],
    documentos: [],
    alertas: [],
    now: new Date("2026-07-24T12:00:00Z"),
  });

  assert.equal(result.cobertura.preenchidos, 2);
  assert.equal(result.confianca, "baixa");
  assert.ok(result.dados_faltantes.includes("ocupação"));
  assert.ok(result.dados_faltantes.includes("objetivo patrimonial"));
});

test("preferência por liquidez prioriza venda", () => {
  const alternativas = buildCarteiraAlternativas({
    preferencia: "liquidez",
    prazo: "6 meses",
    capacidade_investimento: 0,
    diagnostico: diagnosticarCarteira({
      imovel: { ocupacao: "vazio", objetivo: "venda" },
    }),
  });

  assert.equal(alternativas.length, 4);
  assert.equal(alternativas[0].tipo, "vender");
  assert.equal(alternativas.at(-1)?.tipo, "transformar");
});

test("preferência por renda prioriza alternativa de locação", () => {
  const alternativas = buildCarteiraAlternativas({
    preferencia: "renda",
    prazo: "12 meses",
    capacidade_investimento: 50000,
  });

  assert.equal(alternativas[0].tipo, "renda");
  assert.ok(alternativas.every((item) => item.premissas.length > 0));
  assert.ok(alternativas.every((item) => item.validacoes.length > 0));
});

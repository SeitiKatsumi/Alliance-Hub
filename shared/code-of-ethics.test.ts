import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { CODIGO_ETICA_BUILT, CODIGO_ETICA_BUILT_VERSAO, codigoEticaPorVersao } from "./code-of-ethics";

test("Código de Ética mantém as seis cláusulas do documento recebido", () => {
  assert.equal(CODIGO_ETICA_BUILT, [
    "CÓDIGO DE ÉTICA BUILT",
    "01 Eu cumprirei minhas entregas, acordos e responsabilidades com excelência, ética e compromisso.",
    "02 Eu agirei com transparência, lealdade e respeito em todas as relações.",
    "03 Eu protegerei a confiança construída e a reputação coletiva.",
    "04 Eu assumirei responsabilidade integral por minhas ações, decisões, compromissos e conduta.",
    "05 Eu demonstrarei postura construtiva, colaborativa e comprometida com a continuidade das alianças.",
    "06 Eu honrarei os esforços, a confiança e a dignidade dos meus aliados acima do ganho individual de curto prazo.",
  ].join("\n\n"));
  assert.equal(codigoEticaPorVersao(CODIGO_ETICA_BUILT_VERSAO), CODIGO_ETICA_BUILT);
});

test("comprovantes preservam texto antigo e não atribuem texto atual a versão desconhecida", () => {
  const legacy = codigoEticaPorVersao("BUILT JUR - 1");
  assert.match(legacy!, /minhas ações, decisões e conduta/);
  assert.match(legacy!, /esforços e a dignidade dos meus aliados acima do lucro\./);
  assert.doesNotMatch(legacy!, /ganho individual|01 Eu/);
  for (const version of [null, undefined, "", "desconhecida"]) assert.equal(codigoEticaPorVersao(version), undefined);
});

test("cadastro, fallback da aplicação e API usam a mesma fonte; PDF resolve a versão aceita", () => {
  for (const file of ["client/src/App.tsx", "client/src/pages/adesao.tsx", "server/routes.ts"]) {
    const code = readFileSync(file, "utf8");
    assert.match(code, /import .*CODIGO_ETICA_BUILT.*code-of-ethics/);
    assert.doesNotMatch(code, /Eu honrarei os esforços/);
  }
  assert.match(readFileSync("server/routes.ts", "utf8"), /codigoEticaPorVersao\(documento.versao\)/);
});

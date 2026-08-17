import test from "node:test";
import assert from "node:assert/strict";
import {
  isProfessionalPurpose,
  mergePropertyExtraction,
  nextPropertyAssistantStep,
  normalizeAccountPurposes,
  normalizeDemandClosureReason,
  normalizeDemandDistributionMode,
  normalizeDemandKind,
  normalizeInitialPropertyJourney,
  normalizePropertyIntent,
  resolveAccountPurposesForInvite,
  scorePropertyProfessionalMatch,
} from "./property-journey";

test("account purposes are independent and legacy vitrine maps to professional", () => {
  assert.deepEqual(normalizeAccountPurposes(["imoveis", "capital", "imoveis"]), ["imoveis", "capital"]);
  assert.deepEqual(normalizeAccountPurposes(["vitrine"]), ["profissional"]);
  assert.equal(isProfessionalPurpose(["imoveis"]), false);
  assert.equal(isProfessionalPurpose(["imoveis", "profissional"]), true);
});

test("legacy invites suggest a purpose without overriding the user's choices", () => {
  assert.deepEqual(resolveAccountPurposesForInvite([], "vitrine"), ["profissional"]);
  assert.deepEqual(resolveAccountPurposesForInvite([], "capital"), ["capital"]);
  assert.deepEqual(resolveAccountPurposesForInvite([], "unificado"), ["imoveis"]);
  assert.deepEqual(resolveAccountPurposesForInvite(["imoveis"], "vitrine"), ["imoveis"]);
  assert.deepEqual(
    resolveAccountPurposesForInvite(["imoveis", "profissional", "capital"], "vitrine"),
    ["imoveis", "profissional", "capital"],
  );
});

test("property assistant keeps a stable ordered journey", () => {
  assert.equal(nextPropertyAssistantStep("intencao"), "cadastro");
  assert.equal(nextPropertyAssistantStep("cadastro"), "analise");
  assert.equal(nextPropertyAssistantStep("conexao"), "concluido");
  assert.equal(normalizePropertyIntent("estruturar aliança"), "estruturar_alianca");
  assert.equal(normalizePropertyIntent("reformar"), "reformar");
});

test("first access property answers must be complete and valid", () => {
  assert.deepEqual(normalizeInitialPropertyJourney({
    path: "imovel",
    intencao: "vender",
    method: "cartorio",
  }), {
    path: "imovel",
    intencao: "vender",
    method: "cartorio",
  });
  assert.deepEqual(normalizeInitialPropertyJourney({ path: "imovel", intencao: "vender" }), {
    path: "imovel",
    intencao: "vender",
  });
  assert.equal(normalizeInitialPropertyJourney({ path: "imovel", intencao: "vender", method: "invalido" }), null);
  assert.equal(normalizeInitialPropertyJourney({ path: "proprio", intencao: "vender", method: "manual" }), null);
});

test("property extraction fills blanks and reports conflicts without replacing confirmed values", () => {
  const result = mergePropertyExtraction(
    { nome: "Lote 09", cidade: "Lagoa Santa", area_m2: "" },
    { nome: "Lote nove", cidade: "Lagoa Santa", area_m2: 700 },
    "matricula.pdf",
  );

  assert.deepEqual(result.draft, {
    nome: "Lote 09",
    cidade: "Lagoa Santa",
    area_m2: 700,
  });
  assert.deepEqual(result.conflicts, {
    nome: { atual: "Lote 09", extraido: "Lote nove", fonte: "matricula.pdf" },
  });
});

test("generic intent does not recommend unrelated BUILT members", () => {
  const match = scorePropertyProfessionalMatch({
    intent: "gerir",
    professionalSpecialties: ["Marketing", "Liderança"],
    propertyCity: "Lagoa Santa",
    professionalCity: "Lagoa Santa",
    isBuiltMember: true,
  });

  assert.equal(match.eligible, false);
  assert.equal(match.score, 0);
});

test("professional compatibility explains specialty and location points", () => {
  const match = scorePropertyProfessionalMatch({
    intent: "reformar",
    professionalSpecialties: ["Arquitetura", "Design de Interiores"],
    propertyCity: "Lagoa Santa",
    professionalCity: "Lagoa Santa",
    isBuiltMember: true,
    hasProfessionalProfile: true,
  });

  assert.equal(match.eligible, true);
  assert.equal(match.score, 90);
  assert.deepEqual(match.matchedSpecialties, ["Arquitetura", "Design de Interiores"]);
  assert.ok(match.reasons.includes("Atua na mesma cidade"));
});

test("demand rules normalize human aliases", () => {
  assert.equal(normalizeDemandKind("vender"), "venda");
  assert.equal(normalizeDemandKind("serviço"), "servico_fornecimento");
  assert.equal(normalizeDemandDistributionMode("direcionada"), "direcionada");
  assert.equal(normalizeDemandDistributionMode("qualquer"), "pulso");
  assert.equal(normalizeDemandClosureReason("necessidade alterada"), "necessidade_alterada");
  assert.equal(normalizeDemandClosureReason("invalido"), null);
});

import test from "node:test";
import assert from "node:assert/strict";
import { classifyBusinessFeedContext, scoreBusinessFeedCandidate, sortBusinessFeed } from "./member-business-feed";

test("business feed prioritizes competence and location matches", () => {
  const profile = {
    specialties: ["Projeto elétrico"],
    contributionAreas: ["Execução"],
    city: "Campinas",
    state: "SP",
    country: "Brasil",
  };
  const matching = scoreBusinessFeedCandidate(profile, {
    title: "Projeto elétrico para centro logístico",
    specialties: ["Projeto"],
    city: "Campinas",
    state: "SP",
    country: "Brasil",
  });
  const distant = scoreBusinessFeedCandidate(profile, {
    title: "Consultoria jurídica",
    city: "Recife",
    state: "PE",
    country: "Brasil",
  });
  assert.ok(matching.score > distant.score);
  assert.ok(matching.reasons.some((reason) => reason.includes("cidade")));
});

test("direct delivery and prior interest increase relevance", () => {
  const regular = scoreBusinessFeedCandidate({}, { title: "Oportunidade" });
  const engaged = scoreBusinessFeedCandidate({}, { title: "Oportunidade", delivered: true, interested: true });
  assert.ok(engaged.score > regular.score);
});

test("business feed sorting uses relevance before recency", () => {
  const sorted = sortBusinessFeed([
    { id: "new", aderencia: 50, data: "2026-08-13" },
    { id: "relevant", aderencia: 90, data: "2026-08-01" },
  ]);
  assert.equal(sorted[0].id, "relevant");
});

test("network opportunities move to activity only after engagement", () => {
  assert.equal(classifyBusinessFeedContext({ type: "demanda" }), "recomendado");
  assert.equal(classifyBusinessFeedContext({ type: "oba", interested: true }), "em_andamento");
  assert.equal(classifyBusinessFeedContext({ type: "demanda", delivered: true }), "em_andamento");
  assert.equal(classifyBusinessFeedContext({ type: "oba", managed: true }), "em_andamento");
});

test("meetings and invitations have dedicated activity contexts", () => {
  assert.equal(classifyBusinessFeedContext({ type: "ro" }), "agenda");
  assert.equal(classifyBusinessFeedContext({ type: "bia" }), "convite");
});

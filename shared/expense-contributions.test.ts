import test from "node:test";
import assert from "node:assert/strict";
import { splitExpense, inheritedExpenseSplit } from "./expense-contributions";

test("herda rateio da saída em percentual ou valor e conserva os centavos", () => {
  assert.deepEqual(inheritedExpenseSplit(100, "percentual", ["a","b","c"].map(memberId => ({ memberId, value: 33.33 }))).map(p => p.amount), [33.34,33.33,33.33]);
  assert.deepEqual(inheritedExpenseSplit(150, "valor", ["a","b","c"].map(memberId => ({ memberId, value: 50 }))).map(p => p.amount), [50,50,50]);
  assert.throws(() => inheritedExpenseSplit(100,"percentual",[{memberId:"a",value:90}]));
});

test("rateio da despesa conserva centavos, ordenação e proporções", () => {
  const people = ["c", "a", "b"].map(memberId => ({ memberId }));
  assert.deepEqual(splitExpense(150, "equal", people).map(p => p.amount), [50, 50, 50]);
  assert.deepEqual(splitExpense(100, "equal", people).map(p => p.amount), [33.34, 33.33, 33.33]);
  assert.deepEqual(splitExpense(100, "map", people, [{ memberId: "a", percent: 20 }, { memberId: "b", percent: 30 }, { memberId: "c", percent: 50 }]).map(p => p.amount), [20, 30, 50]);
  assert.deepEqual(splitExpense(100, "manual", [{ memberId: "a", value: 10.01 }, { memberId: "b", value: 89.99 }]).map(p => p.amount), [10.01, 89.99]);
  assert.throws(() => splitExpense(100, "manual", [{ memberId: "a", value: 99.99 }]));
  assert.throws(() => splitExpense(100, "equal", [{ memberId: "a" }, { memberId: "a" }]));
  assert.throws(() => splitExpense(0.01, "equal", people));
  assert.throws(() => splitExpense(1, "map", people, []));
  assert.throws(() => splitExpense(1.001, "equal", people));
});

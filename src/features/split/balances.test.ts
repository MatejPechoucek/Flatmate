// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { balancesFor, netBalances, simplifyDebts } from "./balances.ts";

const expense = (payer: string, shares: Record<string, number>, deleted = false) => ({
  payer_id: payer,
  amount_pence: Object.values(shares).reduce((a, b) => a + b, 0),
  deleted_at: deleted ? "2026-10-16" : null,
  expense_shares: Object.entries(shares).map(([member_id, amount_pence]) => ({ member_id, amount_pence })),
});

test("Worked example: A and B each paid £30 for A/B/C → C pays both", () => {
  const net = netBalances(
    [expense("A", { A: 1000, B: 1000, C: 1000 }), expense("B", { A: 1000, B: 1000, C: 1000 })],
    [],
  );
  assert.deepEqual(net, { A: 1000, B: 1000, C: -2000 });
  assert.deepEqual(simplifyDebts(net), [
    { from: "C", to: "A", pence: 1000 },
    { from: "C", to: "B", pence: 1000 },
  ]);
});

test("simplification removes a chain: A→B→C becomes A→C", () => {
  const net = netBalances([expense("B", { A: 500 }), expense("C", { B: 500 })], []);
  assert.deepEqual(simplifyDebts(net), [{ from: "A", to: "C", pence: 500 }]);
});

test("settlements reduce what's owed", () => {
  const exp = [expense("A", { A: 1000, B: 1000 })];
  assert.deepEqual(simplifyDebts(netBalances(exp, [{ from_member: "B", to_member: "A", amount_pence: 400 }])), [
    { from: "B", to: "A", pence: 600 },
  ]);
  assert.deepEqual(simplifyDebts(netBalances(exp, [{ from_member: "B", to_member: "A", amount_pence: 1000 }])), []);
});

test("deleted expenses are ignored", () => {
  assert.deepEqual(simplifyDebts(netBalances([expense("A", { B: 1000 }, true)], [])), []);
});

test("payer not in the split is owed the full amount", () => {
  assert.deepEqual(simplifyDebts(netBalances([expense("A", { B: 500, C: 500 })], [])), [
    { from: "B", to: "A", pence: 500 },
    { from: "C", to: "A", pence: 500 },
  ]);
});

test("balancesFor gives one member's view", () => {
  const plan = [
    { from: "C", to: "A", pence: 1000 },
    { from: "A", to: "B", pence: 300 },
  ];
  assert.deepEqual(balancesFor(plan, "A"), [
    { member_id: "C", pence: 1000 },
    { member_id: "B", pence: -300 },
  ]);
  assert.deepEqual(balancesFor(plan, "D"), []);
});

test("fuzz: plan settles everyone in at most n−1 payments", () => {
  for (let i = 0; i < 500; i++) {
    const ids = ["A", "B", "C", "D", "E"].slice(0, 2 + Math.floor(Math.random() * 4));
    const exps = Array.from({ length: 1 + Math.floor(Math.random() * 8) }, () => {
      const shares: Record<string, number> = {};
      for (const id of ids) if (Math.random() < 0.7) shares[id] = 1 + Math.floor(Math.random() * 5000);
      if (!Object.keys(shares).length) shares[ids[0]] = 100;
      return expense(ids[Math.floor(Math.random() * ids.length)], shares);
    });
    const net = netBalances(exps, []);
    assert.equal(Object.values(net).reduce((a, b) => a + b, 0), 0);

    const plan = simplifyDebts(net);
    assert.ok(plan.length <= ids.length - 1);
    const after = { ...net };
    for (const t of plan) {
      assert.ok(t.pence > 0);
      after[t.from] += t.pence;
      after[t.to] -= t.pence;
    }
    assert.ok(Object.values(after).every((p) => p === 0));
  }
});

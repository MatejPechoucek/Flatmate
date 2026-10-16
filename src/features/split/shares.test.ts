// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeShares, remaining, SplitError } from "./shares.ts";

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

test("equal: leftover penny goes to the payer", () => {
  assert.deepEqual(computeShares(1000, "equal", "A", { A: 0, B: 0, C: 0 }), { A: 334, B: 333, C: 333 });
});

test("equal: payer excluded still absorbs the leftover", () => {
  assert.deepEqual(computeShares(1000, "equal", "A", { B: 0, C: 0 }), { B: 500, C: 500 });
  assert.deepEqual(computeShares(1001, "equal", "A", { B: 0, C: 0 }), { B: 500, C: 500, A: 1 });
});

test("percent: payer excluded still absorbs the leftover", () => {
  assert.deepEqual(computeShares(1001, "percent", "A", { B: 50, C: 50 }), { B: 500, C: 500, A: 1 });
});

test("equal: single participant takes everything", () => {
  assert.deepEqual(computeShares(4260, "equal", "A", { B: 0 }), { B: 4260 });
});

test("percent: exact", () => {
  assert.deepEqual(computeShares(1000, "percent", "A", { A: 50, B: 25, C: 25 }), { A: 500, B: 250, C: 250 });
});

test("percent: rounding leftover to payer", () => {
  assert.deepEqual(computeShares(1001, "percent", "A", { A: 33, B: 33, C: 34 }), { A: 331, B: 330, C: 340 });
});

test("percent: two-decimal thirds", () => {
  const r = computeShares(1000, "percent", "A", { A: 33.33, B: 33.33, C: 33.34 });
  assert.equal(sum(r), 1000);
  assert.deepEqual(r, { A: 334, B: 333, C: 333 });
});

test("percent: must total 100", () => {
  assert.throws(() => computeShares(1000, "percent", "A", { A: 50, B: 40 }), /10% still to assign/);
  assert.throws(() => computeShares(1000, "percent", "A", { A: 60, B: 50 }), /10% too much/);
});

test("percent: more than 2 decimals rejected", () => {
  assert.throws(() => computeShares(1000, "percent", "A", { A: 33.333, B: 66.667 }), SplitError);
});

test("amount: exact", () => {
  assert.deepEqual(computeShares(1000, "amount", "A", { A: 600, B: 400 }), { A: 600, B: 400 });
});

test("amount: must total the expense", () => {
  assert.throws(() => computeShares(1000, "amount", "A", { A: 600, B: 300 }), /£1.00 still to assign/);
  assert.throws(() => computeShares(1000, "amount", "A", { A: 600, B: 500 }), /£1.00 too much/);
});

test("zero shares are omitted", () => {
  assert.deepEqual(computeShares(1000, "amount", "A", { A: 1000, B: 0 }), { A: 1000 });
  assert.deepEqual(computeShares(1000, "percent", "A", { A: 100, B: 0 }), { A: 1000 });
});

test("invalid input", () => {
  assert.throws(() => computeShares(0, "equal", "A", { A: 0 }), /above £0/);
  assert.throws(() => computeShares(10.5, "equal", "A", { A: 0 }), SplitError);
  assert.throws(() => computeShares(1000, "equal", "A", {}), /at least one/);
  assert.throws(() => computeShares(1000, "amount", "A", { A: 1100, B: -100 }), /negative/);
  assert.throws(() => computeShares(1000, "amount", "A", { A: 999.5, B: 0.5 }), /whole pence/);
});

test("shares always sum to the amount (fuzz)", () => {
  for (let i = 0; i < 2000; i++) {
    const amount = 1 + Math.floor(Math.random() * 100_000);
    const n = 1 + Math.floor(Math.random() * 6);
    const ids = Array.from({ length: n }, (_, k) => `m${k}`);
    const r = computeShares(amount, "equal", ids[Math.floor(Math.random() * n)], Object.fromEntries(ids.map((id) => [id, 0])));
    assert.equal(sum(r), amount);
    const vals = Object.values(r);
    assert.ok(Math.max(...vals) - Math.min(...vals) <= n); // within leftover range
    assert.ok(Object.keys(r).length <= n + 1);
  }
});

test("remaining helper", () => {
  assert.equal(remaining(1000, "amount", { A: 600 }), 400);
  assert.equal(remaining(1000, "amount", { A: 600, B: 500 }), -100);
  assert.equal(remaining(1000, "percent", { A: 33.33, B: 33.33 }), 33.34);
  assert.equal(remaining(1000, "equal", {}), 0);
});


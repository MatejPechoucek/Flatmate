// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { cannotChange, diffFor, isNoticeFor, type ChangeLike } from "./changes.ts";

const before = { description: "Tesco shop", amount_pence: 4260, payer_id: "A", shares: { A: 1065, B: 1065, C: 1065, D: 1065 } };

test("edit: amount + share change, seen by an affected flatmate", () => {
  const c: ChangeLike = {
    changed_by: "A",
    kind: "edit",
    before,
    after: { ...before, amount_pence: 5260, shares: { A: 1315, B: 1315, C: 1315, D: 1315 } },
  };
  assert.equal(isNoticeFor(c, "B"), true);
  assert.equal(isNoticeFor(c, "A"), false); // own change
  assert.deepEqual(diffFor(c, "B"), [
    { field: "amount", from: 4260, to: 5260 },
    { field: "yourShare", from: 1065, to: 1315 },
  ]);
});

test("removed from the split still gets told", () => {
  const c: ChangeLike = { changed_by: "A", kind: "edit", before, after: { ...before, shares: { A: 1420, B: 1420, C: 1420 } } };
  assert.equal(isNoticeFor(c, "D"), true);
  assert.deepEqual(diffFor(c, "D"), [{ field: "yourShare", from: 1065, to: 0 }]);
});

test("added to the split gets told", () => {
  const small = { ...before, shares: { A: 2130, B: 2130 } };
  const c: ChangeLike = { changed_by: "A", kind: "edit", before: small, after: before };
  assert.equal(isNoticeFor(c, "C"), true);
});

test("unaffected flatmate sees nothing", () => {
  const two = { ...before, payer_id: "A", shares: { A: 2130, B: 2130 } };
  const c: ChangeLike = { changed_by: "A", kind: "edit", before: two, after: { ...two, description: "Big shop" } };
  assert.equal(isNoticeFor(c, "C"), false);
  assert.deepEqual(diffFor(c, "B"), [{ field: "description", from: "Tesco shop", to: "Big shop" }]);
});

test("payer change", () => {
  const c: ChangeLike = { changed_by: "A", kind: "edit", before, after: { ...before, payer_id: "B" } };
  assert.deepEqual(diffFor(c, "C"), [{ field: "payer", from: "A", to: "B" }]);
});

test("split moved between others only", () => {
  const c: ChangeLike = { changed_by: "A", kind: "edit", before, after: { ...before, shares: { A: 1000, B: 1130, C: 1065, D: 1065 } } };
  assert.deepEqual(diffFor(c, "C"), [{ field: "splitOnly" }]);
});

test("delete has no diff but notifies participants", () => {
  const c: ChangeLike = { changed_by: "A", kind: "delete", before, after: null };
  assert.equal(isNoticeFor(c, "C"), true);
  assert.deepEqual(diffFor(c, "C"), []);
});

test("cannotChange: creator only, missing creator falls back to the payer, buyouts locked", () => {
  const e = { payer_id: "A", created_by: "B", bounty_id: null, deleted_at: null };
  assert.equal(cannotChange(e, "B"), null);
  assert.match(cannotChange(e, "A")!, /Only the person who added/);
  assert.equal(cannotChange({ ...e, created_by: null }, "A"), null); // seed / SQL-inserted rows
  assert.match(cannotChange({ ...e, bounty_id: "x" }, "B")!, /buyouts/);
  assert.match(cannotChange({ ...e, deleted_at: "2026-10-16" }, "B")!, /deleted/);
});

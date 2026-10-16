// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { dueDatesUntil, nextDue, occurrenceLabel, startOfDayIso } from "./schedule.ts";

test("weekly adds 7 days", () => {
  assert.equal(nextDue("2026-10-16T00:00:00.000Z", "weekly"), "2026-10-23T00:00:00.000Z");
  assert.equal(nextDue("2026-12-29T00:00:00.000Z", "weekly"), "2027-01-05T00:00:00.000Z");
});

test("monthly keeps the day", () => {
  assert.equal(nextDue("2026-10-16T00:00:00.000Z", "monthly"), "2026-11-16T00:00:00.000Z");
  assert.equal(nextDue("2026-12-16T00:00:00.000Z", "monthly"), "2027-01-16T00:00:00.000Z");
});

test("monthly clamps to short months", () => {
  assert.equal(nextDue("2027-01-31T00:00:00.000Z", "monthly"), "2027-02-28T00:00:00.000Z");
  assert.equal(nextDue("2028-01-31T00:00:00.000Z", "monthly"), "2028-02-29T00:00:00.000Z"); // leap year
  assert.equal(nextDue("2026-10-31T00:00:00.000Z", "monthly"), "2026-11-30T00:00:00.000Z");
});

test("dueDatesUntil catches up missed periods, inclusive of now", () => {
  const now = new Date("2026-12-16T00:00:00.000Z");
  assert.deepEqual(dueDatesUntil("2026-10-16T00:00:00.000Z", "monthly", now), [
    "2026-10-16T00:00:00.000Z",
    "2026-11-16T00:00:00.000Z",
    "2026-12-16T00:00:00.000Z",
  ]);
  assert.deepEqual(dueDatesUntil("2026-12-17T00:00:00.000Z", "monthly", now), []);
});

test("dueDatesUntil is capped", () => {
  assert.equal(dueDatesUntil("2000-01-01T00:00:00.000Z", "weekly", new Date("2026-01-01"), 24).length, 24);
});

test("labels", () => {
  assert.equal(occurrenceLabel("Wi-Fi", "2026-10-16T00:00:00.000Z", "monthly"), "Wi-Fi · Oct");
  assert.equal(occurrenceLabel("Cleaner", "2026-10-16T00:00:00.000Z", "weekly"), "Cleaner · 16 Oct");
});

test("startOfDayIso", () => {
  assert.equal(startOfDayIso("2026-10-16"), "2026-10-16T00:00:00.000Z");
});

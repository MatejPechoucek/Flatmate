// Run: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePayHandle, payLink } from "./money.ts";

test("normalizePayHandle accepts the ways people type a PayPal.me handle", () => {
  for (const input of ["priyak", " @priyak ", "paypal.me/priyak", "https://www.paypal.me/priyak/10", "PayPal.me/priyak?x=1", "paypal:priyak"]) {
    assert.equal(normalizePayHandle(input), "priyak", input);
  }
  assert.equal(normalizePayHandle("   "), "");
});

test("payLink builds a GBP PayPal.me link", () => {
  assert.equal(payLink("paypal.me/priyak", 950), "https://paypal.me/priyak/9.50GBP");
  assert.equal(payLink("paypal:priyak", 1200), "https://paypal.me/priyak/12.00GBP");
});

// Pure split maths — no imports at runtime, so it can be unit-tested with `node --test`.
// All money is integer pence. Percentages are accepted with up to 2 decimals (33.33%)
// and handled internally as integer basis points (1% = 100 bp) to avoid float drift.
import type { SplitType } from "@/lib/types";

/** Thrown for invalid split input. `message` is safe to show in the UI. */
export class SplitError extends Error {
  name = "SplitError";
}

const BP_TOTAL = 10_000; // 100.00%

/**
 * Turn the user's split input into final pence owed per member.
 *
 * `values` has one key per **participant**:
 *   - equal:   values ignored
 *   - amount:  pence each; must sum to amountPence
 *   - percent: 0–100 (≤ 2 decimals); must sum to 100
 *
 * Leftover pence from rounding always go to the payer, so the payer absorbs them — even when
 * the payer isn't a participant (they then get a tiny share of their own expense, i.e. the
 * others owe slightly less). Members whose share is 0 are omitted from the result.
 */
export function computeShares(
  amountPence: number,
  splitType: SplitType,
  payerId: string,
  values: Record<string, number>,
): Record<string, number> {
  if (!Number.isInteger(amountPence) || amountPence <= 0) throw new SplitError("Enter an amount above £0.");

  const ids = Object.keys(values);
  if (ids.length === 0) throw new SplitError("Pick at least one person to split with.");
  for (const id of ids) {
    const v = values[id];
    if (!Number.isFinite(v) || v < 0) throw new SplitError("Amounts can't be negative.");
  }

  let shares: Record<string, number>;

  switch (splitType) {
    case "equal": {
      const each = Math.floor(amountPence / ids.length);
      shares = Object.fromEntries(ids.map((id) => [id, each]));
      break;
    }
    case "amount": {
      if (ids.some((id) => !Number.isInteger(values[id]))) throw new SplitError("Amounts must be whole pence.");
      const total = ids.reduce((sum, id) => sum + values[id], 0);
      if (total !== amountPence) {
        throw new SplitError(remainingMessage(amountPence - total, "amount"));
      }
      shares = { ...values };
      break;
    }
    case "percent": {
      const bp = Object.fromEntries(ids.map((id) => [id, toBasisPoints(values[id])]));
      const total = ids.reduce((sum, id) => sum + bp[id], 0);
      if (total !== BP_TOTAL) throw new SplitError(remainingMessage(BP_TOTAL - total, "percent"));
      shares = Object.fromEntries(ids.map((id) => [id, Math.floor((amountPence * bp[id]) / BP_TOTAL)]));
      break;
    }
  }

  // The payer absorbs rounding leftovers.
  const assigned = ids.reduce((sum, id) => sum + shares[id], 0);
  const leftover = amountPence - assigned;
  if (leftover > 0) shares[payerId] = (shares[payerId] ?? 0) + leftover;

  return Object.fromEntries(Object.entries(shares).filter(([, pence]) => pence > 0));
}

/**
 * For live form feedback: how much is still unassigned.
 * amount → pence left · percent → percentage points left (e.g. 12.5) · equal → always 0.
 * Negative means over-assigned.
 */
export function remaining(amountPence: number, splitType: SplitType, values: Record<string, number>): number {
  const nums = Object.values(values).filter((v) => Number.isFinite(v));
  if (splitType === "amount") return amountPence - nums.reduce((a, b) => a + b, 0);
  if (splitType === "percent") return (BP_TOTAL - nums.reduce((a, v) => a + toBasisPoints(v), 0)) / 100;
  return 0;
}

function toBasisPoints(percent: number): number {
  const bp = Math.round(percent * 100);
  if (Math.abs(bp - percent * 100) > 1e-6) throw new SplitError("Percentages can have at most 2 decimals.");
  return bp;
}

function remainingMessage(diff: number, kind: "amount" | "percent"): string {
  const abs = Math.abs(diff);
  const text = kind === "amount" ? `£${(abs / 100).toFixed(2)}` : `${abs / 100}%`;
  return diff > 0 ? `${text} still to assign.` : `${text} too much assigned.`;
}

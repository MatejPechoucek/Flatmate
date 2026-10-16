// Pure logic for edit/delete notices — no runtime imports, unit-tested with `node --test`.

export interface Snapshot {
  description: string;
  amount_pence: number;
  payer_id: string;
  shares: Record<string, number>;
}

export interface ChangeLike {
  changed_by: string;
  kind: "edit" | "delete";
  before: Snapshot;
  after: Snapshot | null;
}

/** Everyone a change touches: payer or participant before or after. */
export function affectedMembers(c: ChangeLike): Set<string> {
  const ids = new Set<string>([c.before.payer_id, ...Object.keys(c.before.shares)]);
  if (c.after) [c.after.payer_id, ...Object.keys(c.after.shares)].forEach((id) => ids.add(id));
  return ids;
}

/** Should `memberId` see a notice? Not for their own changes, only if it touches them. */
export function isNoticeFor(c: ChangeLike, memberId: string): boolean {
  return c.changed_by !== memberId && affectedMembers(c).has(memberId);
}

export type Diff =
  | { field: "description"; from: string; to: string }
  | { field: "amount"; from: number; to: number }
  | { field: "payer"; from: string; to: string }
  | { field: "yourShare"; from: number; to: number }
  | { field: "splitOnly" }; // something changed, but not for you and not the headline fields

/**
 * What changed, from `memberId`'s point of view. "yourShare" is included whenever their share
 * moved (0 = not part of it). Empty for deletes — the caller shows the before snapshot.
 */
export function diffFor(c: ChangeLike, memberId: string): Diff[] {
  if (!c.after) return [];
  const { before: b, after: a } = c;
  const diffs: Diff[] = [];
  if (b.description !== a.description) diffs.push({ field: "description", from: b.description, to: a.description });
  if (b.amount_pence !== a.amount_pence) diffs.push({ field: "amount", from: b.amount_pence, to: a.amount_pence });
  if (b.payer_id !== a.payer_id) diffs.push({ field: "payer", from: b.payer_id, to: a.payer_id });
  const mine = [b.shares[memberId] ?? 0, a.shares[memberId] ?? 0];
  if (mine[0] !== mine[1]) diffs.push({ field: "yourShare", from: mine[0], to: mine[1] });
  if (diffs.length === 0) diffs.push({ field: "splitOnly" });
  return diffs;
}

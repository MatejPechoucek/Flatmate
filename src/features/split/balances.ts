// Pure balance maths — no runtime imports, unit-tested with `node --test`. All values in pence.

export interface Transfer {
  from: string; // pays
  to: string; // receives
  pence: number;
}

interface ExpenseLike {
  payer_id: string;
  amount_pence: number;
  deleted_at?: string | null;
  expense_shares: { member_id: string; amount_pence: number }[];
}

interface SettlementLike {
  from_member: string;
  to_member: string;
  amount_pence: number;
}

/**
 * Net position per member: + means the flat owes them, − means they owe the flat.
 * net = paid − owed + settlements sent − settlements received. Always sums to 0.
 */
export function netBalances(expenses: ExpenseLike[], settlements: SettlementLike[]): Record<string, number> {
  const net: Record<string, number> = {};
  const add = (id: string, pence: number) => (net[id] = (net[id] ?? 0) + pence);

  for (const e of expenses) {
    if (e.deleted_at) continue;
    add(e.payer_id, e.amount_pence);
    for (const s of e.expense_shares) add(s.member_id, -s.amount_pence);
  }
  for (const s of settlements) {
    add(s.from_member, s.amount_pence);
    add(s.to_member, -s.amount_pence);
  }
  return net;
}

/**
 * Fewest-payments plan that settles everyone: repeatedly match the biggest debtor with the
 * biggest creditor. Produces at most n − 1 transfers. Deterministic (ties broken by id).
 */
export function simplifyDebts(net: Record<string, number>): Transfer[] {
  const byAmount = (a: [string, number], b: [string, number]) => b[1] - a[1] || a[0].localeCompare(b[0]);
  const creditors = Object.entries(net).filter(([, p]) => p > 0);
  const debtors = Object.entries(net)
    .filter(([, p]) => p < 0)
    .map(([id, p]): [string, number] => [id, -p]);

  const transfers: Transfer[] = [];
  while (creditors.length && debtors.length) {
    creditors.sort(byAmount);
    debtors.sort(byAmount);
    const [creditor, credit] = creditors[0];
    const [debtor, debt] = debtors[0];
    const pence = Math.min(credit, debt);
    transfers.push({ from: debtor, to: creditor, pence });
    creditors[0][1] -= pence;
    debtors[0][1] -= pence;
    if (creditors[0][1] === 0) creditors.shift();
    if (debtors[0][1] === 0) debtors.shift();
  }
  return transfers;
}

/** One member's view of the plan: + they will receive, − they must pay. */
export function balancesFor(plan: Transfer[], memberId: string): { member_id: string; pence: number }[] {
  return plan.flatMap((t) =>
    t.to === memberId
      ? [{ member_id: t.from, pence: t.pence }]
      : t.from === memberId
        ? [{ member_id: t.to, pence: -t.pence }]
        : [],
  );
}

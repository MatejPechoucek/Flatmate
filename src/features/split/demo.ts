// Demo-flat data for the Split tab (shares included). Used when flat.id === DEMO_FLAT_ID.
// Tuned so "you" (Alex) owe Priya £9.50 — enough to demo Settle up.
import { DEMO_FLAT_ID, demoExpenses } from "@/lib/mock";
import type { Settlement } from "@/lib/types";
import type { ExpenseWithShares } from "./api";

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

const demoShares: Record<string, Record<string, number>> = {
  e1: { "m-alex": 1065, "m-sam": 1065, "m-priya": 1065, "m-tom": 1065 },
  e2: { "m-alex": 800, "m-sam": 800, "m-priya": 800, "m-tom": 800 },
  e3: { "m-alex": 345, "m-sam": 345, "m-priya": 460 },
  e4: { "m-alex": 500 },
  e5: { "m-alex": 2000, "m-sam": 2000, "m-priya": 2000, "m-tom": 2000 },
};

const takeaway = {
  id: "e5",
  flat_id: DEMO_FLAT_ID,
  payer_id: "m-priya",
  description: "Friday takeaway",
  amount_pence: 8000,
  split_type: "equal" as const,
  recurring_expense_id: null,
  bounty_id: null,
  due_at: null,
  created_by: "m-priya",
  edited_at: null,
  deleted_at: null,
  created_at: daysAgo(1),
};

const withoutShareField = demoExpenses.map((e) => {
  const { your_share_pence, ...expense } = e;
  void your_share_pence; // display-only field in the shared mock
  return expense;
});

export const demoSplitExpenses: ExpenseWithShares[] = [...withoutShareField, takeaway]
  .map((e) => ({
    ...e,
    expense_shares: Object.entries(demoShares[e.id] ?? {}).map(([member_id, amount_pence]) => ({
      expense_id: e.id,
      member_id,
      amount_pence,
    })),
  }))
  .sort((a, b) => b.created_at.localeCompare(a.created_at));

export const demoSettlements: Settlement[] = [
  { id: "s1", flat_id: DEMO_FLAT_ID, from_member: "m-tom", to_member: "m-alex", amount_pence: 500, created_at: daysAgo(3) },
];

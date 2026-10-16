// Demo-flat data for the Split tab (shares included). Used when flat.id === DEMO_FLAT_ID.
// Tuned so "you" (Alex) owe Priya £9.50 — enough to demo Settle up.
import { DEMO_FLAT_ID, demoExpenses } from "@/lib/mock";
import type { ExpenseChange, RecurringExpense, Settlement } from "@/lib/types";
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

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

export const demoRecurring: RecurringExpense[] = [
  {
    id: "r1",
    flat_id: DEMO_FLAT_ID,
    payer_id: "m-sam",
    description: "Wi-Fi",
    amount_pence: 3200,
    split_type: "equal",
    split_config: { "m-alex": 0, "m-sam": 0, "m-priya": 0, "m-tom": 0 },
    interval: "monthly",
    next_due_at: inDays(28),
    active: true,
    created_at: daysAgo(60),
  },
  {
    id: "r2",
    flat_id: DEMO_FLAT_ID,
    payer_id: "m-alex",
    description: "Netflix",
    amount_pence: 1299,
    split_type: "equal",
    split_config: { "m-alex": 0, "m-priya": 0 },
    interval: "monthly",
    next_due_at: inDays(9),
    active: false,
    created_at: daysAgo(30),
  },
];

/** Priya edited "Cleaning supplies" 4 days ago — shows the notice banner + history. */
export const demoChanges: ExpenseChange[] = [
  {
    id: "c1",
    flat_id: DEMO_FLAT_ID,
    expense_id: "e3",
    changed_by: "m-priya",
    kind: "edit",
    before: { description: "Cleaning stuff", amount_pence: 950, payer_id: "m-priya", shares: { "m-alex": 285, "m-sam": 285, "m-priya": 380 } },
    after: { description: "Cleaning supplies", amount_pence: 1150, payer_id: "m-priya", shares: { "m-alex": 345, "m-sam": 345, "m-priya": 460 } },
    created_at: daysAgo(4),
  },
];

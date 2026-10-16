// Demo-flat data for the Split tab (shares included). Used when flat.id === DEMO_FLAT_ID.
import { demoExpenses } from "@/lib/mock";
import type { ExpenseWithShares } from "./api";

const demoShares: Record<string, Record<string, number>> = {
  e1: { "m-alex": 1065, "m-sam": 1065, "m-priya": 1065, "m-tom": 1065 },
  e2: { "m-alex": 800, "m-sam": 800, "m-priya": 800, "m-tom": 800 },
  e3: { "m-alex": 345, "m-sam": 345, "m-priya": 460 },
  e4: { "m-alex": 500 },
};

export const demoSplitExpenses: ExpenseWithShares[] = demoExpenses.map((e) => {
  const expense: ExpenseWithShares = { ...e, expense_shares: [] };
  delete (expense as Partial<typeof e>).your_share_pence;
  expense.expense_shares = Object.entries(demoShares[e.id] ?? {}).map(([member_id, amount_pence]) => ({
    expense_id: e.id,
    member_id,
    amount_pence,
  }));
  return expense;
});

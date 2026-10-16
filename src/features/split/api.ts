// Split feature — data access and money logic.
// Owns tables: expenses, expense_shares, recurring_expenses, settlements.
//
// Functions marked CONTRACT are used by other parts — keep their signatures stable.
import type { Expense, SplitType } from "@/lib/types";

export interface NewExpense {
  flatId: string;
  payerId: string;
  description: string;
  amountPence: number;
  splitType: SplitType;
  /** Final pence owed per member; must sum to amountPence. Use computeShares() to build it. */
  shares: Record<string, number>;
  bountyId?: string;
}

/**
 * CONTRACT (used by Chores for buyouts). Inserts the expense + its shares.
 * Buyout example: { payerId: doer, shares: { [offerer]: amount }, bountyId }.
 */
export async function addExpense(input: NewExpense): Promise<Expense> {
  void input;
  throw new Error("TODO(split): addExpense");
}

/**
 * Turn the user's split input into final pence per member.
 * equal: values ignored · amount: values are pence · percent: values are 0–100.
 * Rounding leftovers go to the payer.
 */
export function computeShares(
  amountPence: number,
  splitType: SplitType,
  payerId: string,
  values: Record<string, number>,
): Record<string, number> {
  void amountPence;
  void splitType;
  void payerId;
  void values;
  throw new Error("TODO(split): computeShares");
}

/**
 * CONTRACT (used by Home). Net balance per other member, from `meId`'s perspective:
 * positive = they owe me, negative = I owe them. Simplified to the fewest payments if time allows.
 */
export async function getBalances(flatId: string, meId: string): Promise<{ member_id: string; pence: number }[]> {
  void flatId;
  void meId;
  throw new Error("TODO(split): getBalances");
}

export async function recordSettlement(flatId: string, fromMember: string, toMember: string, pence: number): Promise<void> {
  void flatId;
  void fromMember;
  void toMember;
  void pence;
  throw new Error("TODO(split): recordSettlement");
}

/**
 * CONTRACT (called by FlatProvider on open). Create every recurring expense occurrence whose
 * next_due_at <= now, then advance next_due_at. UNIQUE (recurring_expense_id, due_at) makes
 * concurrent calls safe — ignore duplicate-key errors.
 */
export async function catchUpRecurringExpenses(flatId: string): Promise<void> {
  void flatId; // TODO(split)
}

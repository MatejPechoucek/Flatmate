// Split feature — data access and money logic.
// Owns tables: expenses, expense_shares, recurring_expenses, settlements.
//
// Functions marked CONTRACT are used by other parts — keep their signatures stable.
import { supabase } from "@/lib/supabase";
import type { Expense, ExpenseShare, Settlement, SplitType } from "@/lib/types";
import { balancesFor, netBalances, simplifyDebts, type Transfer } from "./balances";
import { SplitError } from "./shares";

export interface NewExpense {
  flatId: string;
  payerId: string;
  /** Who added it; only they can edit/delete it later. */
  createdBy: string;
  description: string;
  amountPence: number;
  splitType: SplitType;
  /** Final pence owed per member; must sum to amountPence. Use computeShares() to build it. */
  shares: Record<string, number>;
  bountyId?: string;
}

/**
 * CONTRACT (general expense inserts). Inserts the expense + its shares.
 * Not for buyouts: Chores' accept_bounty SQL function writes those atomically.
 */
export async function addExpense(input: NewExpense): Promise<Expense> {
  return insertExpense(input);
}

/** Thrown when a recurring occurrence already exists (another device generated it first). */
export class DuplicateOccurrence extends Error {}

/** Shared by addExpense and recurring generation. Not for use outside Split. */
export async function insertExpense(
  input: NewExpense & { recurringExpenseId?: string; dueAt?: string },
): Promise<Expense> {
  const description = input.description.trim();
  if (!description) throw new SplitError("Add a description.");
  if (!Number.isInteger(input.amountPence) || input.amountPence <= 0) throw new SplitError("Enter an amount above £0.");
  const shareRows = Object.entries(input.shares).filter(([, pence]) => pence > 0);
  if (shareRows.length === 0) throw new SplitError("Pick at least one person to split with.");
  const total = shareRows.reduce((sum, [, pence]) => sum + pence, 0);
  if (total !== input.amountPence) throw new SplitError("Shares don't add up to the total.");

  const { data: expense, error } = await supabase
    .from("expenses")
    .insert({
      flat_id: input.flatId,
      payer_id: input.payerId,
      created_by: input.createdBy,
      description,
      amount_pence: input.amountPence,
      split_type: input.splitType,
      bounty_id: input.bountyId ?? null,
      recurring_expense_id: input.recurringExpenseId ?? null,
      due_at: input.dueAt ?? null,
      // Occurrences sit in history on their due date, not when they were generated.
      ...(input.dueAt ? { created_at: input.dueAt } : {}),
    })
    .select()
    .single<Expense>();
  if (error?.code === "23505") throw new DuplicateOccurrence(error.message);
  if (error) throw new Error(`Couldn't save the expense: ${error.message}`);

  const { error: sharesError } = await supabase
    .from("expense_shares")
    .insert(shareRows.map(([member_id, amount_pence]) => ({ expense_id: expense.id, member_id, amount_pence })));
  if (sharesError) {
    // No transactions over the REST API: undo the expense so balances never see half a write.
    await supabase.from("expenses").delete().eq("id", expense.id);
    throw new Error(`Couldn't save the expense: ${sharesError.message}`);
  }

  return expense;
}

export { computeShares, remaining, SplitError } from "./shares";

export type ExpenseWithShares = Expense & { expense_shares: ExpenseShare[] };

/** All non-deleted expenses for the flat, newest first, each with its shares. */
export async function getExpenses(flatId: string): Promise<ExpenseWithShares[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*, expense_shares(*)")
    .eq("flat_id", flatId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .returns<ExpenseWithShares[]>();
  if (error) throw new Error(`Couldn't load expenses: ${error.message}`);
  return data;
}

/** Pence `memberId` owes for this expense (0 if not part of it). */
export function shareOf(expense: ExpenseWithShares, memberId: string): number {
  return expense.expense_shares.find((s) => s.member_id === memberId)?.amount_pence ?? 0;
}

export { balancesFor, netBalances, simplifyDebts, type Transfer } from "./balances";

export async function getSettlements(flatId: string): Promise<Settlement[]> {
  const { data, error } = await supabase
    .from("settlements")
    .select("*")
    .eq("flat_id", flatId)
    .order("created_at", { ascending: false })
    .returns<Settlement[]>();
  if (error) throw new Error(`Couldn't load payments: ${error.message}`);
  return data;
}

/** Fewest-payments plan that settles the whole flat. */
export async function getSettlementPlan(flatId: string): Promise<Transfer[]> {
  const [expenses, settlements] = await Promise.all([getExpenses(flatId), getSettlements(flatId)]);
  return simplifyDebts(netBalances(expenses, settlements));
}

/**
 * CONTRACT (used by Home). `meId`'s side of the simplified plan, one row per flatmate they
 * pay or get paid by: positive = they pay me, negative = I pay them. Empty = all settled.
 */
export async function getBalances(flatId: string, meId: string): Promise<{ member_id: string; pence: number }[]> {
  return balancesFor(await getSettlementPlan(flatId), meId);
}

/** The payer confirms they've paid `toMember` (via PayPal, bank transfer or cash). */
export async function recordSettlement(flatId: string, fromMember: string, toMember: string, pence: number): Promise<Settlement> {
  if (!Number.isInteger(pence) || pence <= 0) throw new SplitError("Enter an amount above £0.");
  if (fromMember === toMember) throw new SplitError("You can't pay yourself.");
  const { data, error } = await supabase
    .from("settlements")
    .insert({ flat_id: flatId, from_member: fromMember, to_member: toMember, amount_pence: pence })
    .select()
    .single<Settlement>();
  if (error) throw new Error(`Couldn't record the payment: ${error.message}`);
  return data;
}

export {
  catchUpRecurringExpenses,
  createRecurringExpense,
  deleteRecurringExpense,
  getRecurringExpenses,
  setRecurringActive,
} from "./recurring";
export {
  cannotChange,
  deleteExpense,
  dismissNotice,
  editExpense,
  getExpenseChanges,
  getMyNotices,
  snapshotOf,
} from "./edits";
export { diffFor, type Diff } from "./changes";

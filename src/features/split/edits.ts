// Editing / deleting expenses, with an audit trail in `expense_changes` that powers notices.
// Permissions are enforced here (client-side): only the creator, never buyouts.
import { supabase } from "@/lib/supabase";
import type { ExpenseChange, ExpenseSnapshot, SplitType } from "@/lib/types";
import type { ExpenseWithShares } from "./api";
import { isNoticeFor } from "./changes";
import { SplitError } from "./shares";

export function snapshotOf(e: ExpenseWithShares): ExpenseSnapshot {
  return {
    description: e.description,
    amount_pence: e.amount_pence,
    payer_id: e.payer_id,
    shares: Object.fromEntries(e.expense_shares.map((s) => [s.member_id, s.amount_pence])),
  };
}

/** Why `memberId` can't edit/delete this expense, or null if they can. */
export function cannotChange(e: ExpenseWithShares, memberId: string): string | null {
  if (e.deleted_at) return "This expense was deleted.";
  if (e.bounty_id) return "Chore buyouts can't be changed.";
  if (e.created_by !== memberId) return "Only the person who added this can change it.";
  return null;
}

async function loadExpense(id: string): Promise<ExpenseWithShares> {
  const { data, error } = await supabase.from("expenses").select("*, expense_shares(*)").eq("id", id).single<ExpenseWithShares>();
  if (error) throw new Error(`Couldn't load the expense: ${error.message}`);
  return data;
}

async function logChange(e: ExpenseWithShares, changedBy: string, kind: "edit" | "delete", after: ExpenseSnapshot | null) {
  const { error } = await supabase
    .from("expense_changes")
    .insert({ flat_id: e.flat_id, expense_id: e.id, changed_by: changedBy, kind, before: snapshotOf(e), after });
  if (error) console.error("Couldn't log expense change", error);
}

export async function editExpense(
  expenseId: string,
  editorId: string,
  input: { description: string; amountPence: number; payerId: string; splitType: SplitType; shares: Record<string, number> },
): Promise<void> {
  const current = await loadExpense(expenseId); // fresh copy, so "before" is accurate
  const blocked = cannotChange(current, editorId);
  if (blocked) throw new SplitError(blocked);

  const description = input.description.trim();
  if (!description) throw new SplitError("Add a label.");
  const shareRows = Object.entries(input.shares).filter(([, p]) => p > 0);
  if (shareRows.reduce((sum, [, p]) => sum + p, 0) !== input.amountPence) throw new SplitError("Shares don't add up to the total.");

  const after: ExpenseSnapshot = {
    description,
    amount_pence: input.amountPence,
    payer_id: input.payerId,
    shares: Object.fromEntries(shareRows),
  };
  if (JSON.stringify(after) === JSON.stringify(snapshotOf(current))) return; // nothing changed

  const { error } = await supabase
    .from("expenses")
    .update({
      description,
      amount_pence: input.amountPence,
      payer_id: input.payerId,
      split_type: input.splitType,
      edited_at: new Date().toISOString(),
    })
    .eq("id", expenseId);
  if (error) throw new Error(`Couldn't save changes: ${error.message}`);

  // Replace shares. No transactions over REST, so restore the old ones if the insert fails.
  await supabase.from("expense_shares").delete().eq("expense_id", expenseId);
  const { error: sharesError } = await supabase
    .from("expense_shares")
    .insert(shareRows.map(([member_id, amount_pence]) => ({ expense_id: expenseId, member_id, amount_pence })));
  if (sharesError) {
    await supabase.from("expense_shares").insert(current.expense_shares);
    await supabase
      .from("expenses")
      .update({ description: current.description, amount_pence: current.amount_pence, payer_id: current.payer_id, split_type: current.split_type, edited_at: current.edited_at })
      .eq("id", expenseId);
    throw new Error(`Couldn't save changes: ${sharesError.message}`);
  }

  await logChange(current, editorId, "edit", after);
}

/** Soft delete: hidden from lists and balances, kept for the audit trail. */
export async function deleteExpense(expenseId: string, editorId: string): Promise<void> {
  const current = await loadExpense(expenseId);
  const blocked = cannotChange(current, editorId);
  if (blocked) throw new SplitError(blocked);

  const { error } = await supabase.from("expenses").update({ deleted_at: new Date().toISOString() }).eq("id", expenseId);
  if (error) throw new Error(`Couldn't delete: ${error.message}`);
  await logChange(current, editorId, "delete", null);
}

/** Full change history of one expense, oldest first. */
export async function getExpenseChanges(expenseId: string): Promise<ExpenseChange[]> {
  const { data, error } = await supabase
    .from("expense_changes")
    .select("*")
    .eq("expense_id", expenseId)
    .order("created_at")
    .returns<ExpenseChange[]>();
  if (error) throw new Error(`Couldn't load the history: ${error.message}`);
  return data;
}

/** Recent changes that touch `meId`, made by someone else, not yet dismissed. Newest first. */
export async function getMyNotices(flatId: string, meId: string): Promise<ExpenseChange[]> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [changes, dismissals] = await Promise.all([
    supabase
      .from("expense_changes")
      .select("*")
      .eq("flat_id", flatId)
      .neq("changed_by", meId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .returns<ExpenseChange[]>(),
    supabase.from("expense_change_dismissals").select("change_id").eq("member_id", meId).returns<{ change_id: string }[]>(),
  ]);
  if (changes.error) throw new Error(`Couldn't load notices: ${changes.error.message}`);
  const dismissed = new Set((dismissals.data ?? []).map((d) => d.change_id));
  return changes.data.filter((c) => !dismissed.has(c.id) && isNoticeFor(c, meId));
}

export async function dismissNotice(changeId: string, meId: string): Promise<void> {
  const { error } = await supabase.from("expense_change_dismissals").upsert({ change_id: changeId, member_id: meId });
  if (error) throw new Error(`Couldn't dismiss: ${error.message}`);
}

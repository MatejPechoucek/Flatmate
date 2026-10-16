// Recurring bills: rules in `recurring_expenses`, occurrences generated into `expenses`.
import { supabase } from "@/lib/supabase";
import type { RecurringExpense, SplitType } from "@/lib/types";
import { DuplicateOccurrence, insertExpense } from "./api";
import { computeShares } from "./shares";
import { dueDatesUntil, nextDue, occurrenceLabel, type Interval } from "./schedule";

export async function getRecurringExpenses(flatId: string): Promise<RecurringExpense[]> {
  const { data, error } = await supabase
    .from("recurring_expenses")
    .select("*")
    .eq("flat_id", flatId)
    .order("created_at")
    .returns<RecurringExpense[]>();
  if (error) throw new Error(`Couldn't load recurring bills: ${error.message}`);
  return data;
}

/**
 * Save a rule, then immediately generate anything already due (a start date of today
 * creates the first expense straight away). `values` is the same participant map the add
 * form passes to computeShares, stored as split_config so each occurrence re-splits fairly.
 */
export async function createRecurringExpense(input: {
  flatId: string;
  payerId: string;
  description: string;
  amountPence: number;
  splitType: SplitType;
  values: Record<string, number>;
  interval: Interval;
  firstDueAt: string;
}): Promise<RecurringExpense> {
  computeShares(input.amountPence, input.splitType, input.payerId, input.values); // validate before saving

  const { data, error } = await supabase
    .from("recurring_expenses")
    .insert({
      flat_id: input.flatId,
      payer_id: input.payerId,
      description: input.description.trim(),
      amount_pence: input.amountPence,
      split_type: input.splitType,
      split_config: input.values,
      interval: input.interval,
      next_due_at: input.firstDueAt,
    })
    .select()
    .single<RecurringExpense>();
  if (error) throw new Error(`Couldn't save the recurring bill: ${error.message}`);

  await catchUpRecurringExpenses(input.flatId);
  return data;
}

export async function setRecurringActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("recurring_expenses").update({ active }).eq("id", id);
  if (error) throw new Error(`Couldn't update the recurring bill: ${error.message}`);
}

/** Stops future bills. Already-generated expenses stay (they're real money). */
export async function deleteRecurringExpense(id: string): Promise<void> {
  const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
  if (error) throw new Error(`Couldn't delete the recurring bill: ${error.message}`);
}

/**
 * CONTRACT (called by FlatProvider on open). For every active rule with next_due_at <= now:
 * create each missed occurrence, then advance next_due_at. Safe when several flatmates open
 * the app at once: duplicates are rejected by UNIQUE (recurring_expense_id, due_at), and
 * next_due_at only advances if nobody else moved it first.
 */
export async function catchUpRecurringExpenses(flatId: string): Promise<void> {
  const now = new Date();
  const { data: rules, error } = await supabase
    .from("recurring_expenses")
    .select("*")
    .eq("flat_id", flatId)
    .eq("active", true)
    .lte("next_due_at", now.toISOString())
    .returns<RecurringExpense[]>();
  if (error) throw new Error(`Couldn't check recurring bills: ${error.message}`);

  for (const rule of rules) {
    const dueDates = dueDatesUntil(rule.next_due_at, rule.interval, now);
    if (dueDates.length === 0) continue;

    for (const dueAt of dueDates) {
      try {
        await insertExpense({
          flatId,
          payerId: rule.payer_id,
          createdBy: rule.payer_id,
          description: occurrenceLabel(rule.description, dueAt, rule.interval),
          amountPence: rule.amount_pence,
          splitType: rule.split_type,
          shares: computeShares(rule.amount_pence, rule.split_type, rule.payer_id, rule.split_config),
          recurringExpenseId: rule.id,
          dueAt,
        });
      } catch (e) {
        if (!(e instanceof DuplicateOccurrence)) console.error("Recurring bill failed", rule.id, e);
      }
    }

    await supabase
      .from("recurring_expenses")
      .update({ next_due_at: nextDue(dueDates[dueDates.length - 1], rule.interval) })
      .eq("id", rule.id)
      .eq("next_due_at", rule.next_due_at); // only if nobody advanced it first
  }
}

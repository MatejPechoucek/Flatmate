// Split state for the demo flat. There's no database behind /flat/demo, so every Split action
// (expenses, edits, deletes, recurring bills, payments, notices) runs against this in-memory
// copy instead. It survives switching tabs; a page reload resets the demo to its start state.
import { DEMO_FLAT_ID } from "@/lib/mock";
import type { ExpenseChange, ExpenseSnapshot, RecurringExpense, Settlement, SplitType } from "@/lib/types";
import type { ExpenseWithShares, NewExpense } from "./api";
import { cannotChange } from "./changes";
import { demoChanges, demoRecurring, demoSettlements, demoSplitExpenses } from "./demo";
import { dueDatesUntil, nextDue, occurrenceLabel, type Interval } from "./schedule";
import { computeShares, SplitError } from "./shares";

interface DemoState {
  expenses: ExpenseWithShares[]; // includes soft-deleted ones (deleted_at set)
  settlements: Settlement[];
  rules: RecurringExpense[];
  changes: ExpenseChange[];
  dismissed: string[]; // notice (change) ids dismissed by "you"
}

let state: DemoState = {
  expenses: demoSplitExpenses,
  settlements: demoSettlements,
  rules: demoRecurring,
  changes: demoChanges,
  dismissed: [],
};
const listeners = new Set<() => void>();

/** Replace slices immutably (new arrays), so useSyncExternalStore sees the change. */
function update(patch: Partial<DemoState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const subscribeDemo = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Stable snapshot getters, one per slice.
export const getDemoExpenses = () => state.expenses;
export const getDemoSettlements = () => state.settlements;
export const getDemoRules = () => state.rules;
export const getDemoChanges = () => state.changes;
export const getDemoDismissed = () => state.dismissed;

const id = (prefix: string) => `demo-${prefix}-${crypto.randomUUID()}`;
const now = () => new Date().toISOString();

function snapshot(e: ExpenseWithShares): ExpenseSnapshot {
  return {
    description: e.description,
    amount_pence: e.amount_pence,
    payer_id: e.payer_id,
    shares: Object.fromEntries(e.expense_shares.map((s) => [s.member_id, s.amount_pence])),
  };
}

function buildExpense(
  input: NewExpense & { recurringExpenseId?: string; dueAt?: string },
): ExpenseWithShares {
  const expenseId = id("expense");
  return {
    id: expenseId,
    flat_id: DEMO_FLAT_ID,
    payer_id: input.payerId,
    description: input.description.trim(),
    amount_pence: input.amountPence,
    split_type: input.splitType,
    recurring_expense_id: input.recurringExpenseId ?? null,
    bounty_id: input.bountyId ?? null,
    due_at: input.dueAt ?? null,
    created_by: input.createdBy,
    edited_at: null,
    deleted_at: null,
    created_at: input.dueAt ?? now(),
    expense_shares: Object.entries(input.shares)
      .filter(([, p]) => p > 0)
      .map(([member_id, amount_pence]) => ({ expense_id: expenseId, member_id, amount_pence })),
  };
}

// ─── Expenses ────────────────────────────────────────────────────────────────

export function demoAddExpense(input: NewExpense): void {
  if (!input.description.trim()) throw new SplitError("Add a label.");
  update({ expenses: [buildExpense(input), ...state.expenses] });
}

export function demoEditExpense(
  expenseId: string,
  editorId: string,
  input: { description: string; amountPence: number; payerId: string; splitType: SplitType; shares: Record<string, number> },
): void {
  const current = state.expenses.find((e) => e.id === expenseId);
  if (!current) throw new SplitError("Expense not found.");
  const blocked = cannotChange(current, editorId);
  if (blocked) throw new SplitError(blocked);

  const edited: ExpenseWithShares = {
    ...current,
    description: input.description.trim(),
    amount_pence: input.amountPence,
    payer_id: input.payerId,
    split_type: input.splitType,
    edited_at: now(),
    expense_shares: Object.entries(input.shares)
      .filter(([, p]) => p > 0)
      .map(([member_id, amount_pence]) => ({ expense_id: expenseId, member_id, amount_pence })),
  };
  const before = snapshot(current);
  const after = snapshot(edited);
  if (JSON.stringify(before) === JSON.stringify(after)) return; // nothing changed

  update({
    expenses: state.expenses.map((e) => (e.id === expenseId ? edited : e)),
    changes: [...state.changes, { id: id("change"), flat_id: DEMO_FLAT_ID, expense_id: expenseId, changed_by: editorId, kind: "edit", before, after, created_at: now() }],
  });
}

export function demoDeleteExpense(expenseId: string, editorId: string): void {
  const current = state.expenses.find((e) => e.id === expenseId);
  if (!current) throw new SplitError("Expense not found.");
  const blocked = cannotChange(current, editorId);
  if (blocked) throw new SplitError(blocked);

  update({
    expenses: state.expenses.map((e) => (e.id === expenseId ? { ...e, deleted_at: now() } : e)),
    changes: [
      ...state.changes,
      { id: id("change"), flat_id: DEMO_FLAT_ID, expense_id: expenseId, changed_by: editorId, kind: "delete", before: snapshot(current), after: null, created_at: now() },
    ],
  });
}

export function demoDismissNotice(changeId: string): void {
  update({ dismissed: [...state.dismissed, changeId] });
}

// ─── Payments ────────────────────────────────────────────────────────────────

export function demoAddSettlement(fromMember: string, toMember: string, pence: number): void {
  const settlement: Settlement = {
    id: id("payment"),
    flat_id: DEMO_FLAT_ID,
    from_member: fromMember,
    to_member: toMember,
    amount_pence: pence,
    created_at: now(),
  };
  update({ settlements: [settlement, ...state.settlements] });
}

// ─── Recurring bills ─────────────────────────────────────────────────────────

/** Same behaviour as the real flat: save the rule, then generate anything already due. */
export function demoCreateRecurring(input: {
  payerId: string;
  description: string;
  amountPence: number;
  splitType: SplitType;
  values: Record<string, number>;
  interval: Interval;
  firstDueAt: string;
}): void {
  const shares = computeShares(input.amountPence, input.splitType, input.payerId, input.values); // validates
  const rule: RecurringExpense = {
    id: id("rule"),
    flat_id: DEMO_FLAT_ID,
    payer_id: input.payerId,
    description: input.description.trim(),
    amount_pence: input.amountPence,
    split_type: input.splitType,
    split_config: input.values,
    interval: input.interval,
    next_due_at: input.firstDueAt,
    active: true,
    created_at: now(),
  };

  const due = dueDatesUntil(rule.next_due_at, rule.interval, new Date());
  const generated = due.map((dueAt) =>
    buildExpense({
      flatId: DEMO_FLAT_ID,
      payerId: rule.payer_id,
      createdBy: rule.payer_id,
      description: occurrenceLabel(rule.description, dueAt, rule.interval),
      amountPence: rule.amount_pence,
      splitType: rule.split_type,
      shares,
      recurringExpenseId: rule.id,
      dueAt,
    }),
  );
  if (due.length) rule.next_due_at = nextDue(due[due.length - 1], rule.interval);

  update({ rules: [...state.rules, rule], expenses: [...generated.reverse(), ...state.expenses] });
}

export function demoSetRecurringActive(ruleId: string, active: boolean): void {
  update({ rules: state.rules.map((r) => (r.id === ruleId ? { ...r, active } : r)) });
}

/** Stops future bills; already-generated expenses stay, like the real flat. */
export function demoDeleteRecurring(ruleId: string): void {
  update({ rules: state.rules.filter((r) => r.id !== ruleId) });
}

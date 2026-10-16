"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useFlat } from "@/lib/flat-context";
import { DEMO_FLAT_ID } from "@/lib/mock";
import { formatPence, parsePounds } from "@/lib/money";
import { Amount, Avatar, Button, Input, List, ListRow, SegmentedControl, Sheet } from "@/components/ui";
import type { SplitType } from "@/lib/types";
import { addExpense, computeShares, createRecurringExpense, editExpense, remaining, SplitError, type ExpenseWithShares } from "./api";
import { startOfDayIso, type Interval } from "./schedule";
import { demoAddExpense, demoCreateRecurring, demoEditExpense } from "./demoStore";

/** Today as a yyyy-mm-dd date input value, in the user's timezone. */
const todayInput = () => new Date().toLocaleDateString("en-CA");

/** Who was "in" a saved expense. A payer holding only the leftover penny wasn't really in it. */
function includedFrom(e: ExpenseWithShares): Set<string> {
  const ids = new Set(e.expense_shares.map((s) => s.member_id));
  const payerShare = e.expense_shares.find((s) => s.member_id === e.payer_id)?.amount_pence ?? 0;
  const others = e.expense_shares.filter((s) => s.member_id !== e.payer_id).map((s) => s.amount_pence);
  if (e.split_type === "equal" && payerShare > 0 && others.length && payerShare < Math.min(...others)) ids.delete(e.payer_id);
  return ids;
}

/** The per-member £ / % text boxes for a saved expense. Percentages are rebuilt from pence. */
function inputsFrom(e: ExpenseWithShares, included: Set<string>): Record<string, string> {
  const rows = e.expense_shares.filter((s) => included.has(s.member_id));
  if (e.split_type === "amount") return Object.fromEntries(rows.map((s) => [s.member_id, (s.amount_pence / 100).toFixed(2)]));
  if (e.split_type !== "percent") return {};
  const bp = rows.map((s) => Math.round((s.amount_pence * 10_000) / e.amount_pence));
  if (bp.length) bp[bp.length - 1] += 10_000 - bp.reduce((a, b) => a + b, 0); // make it total exactly 100%
  return Object.fromEntries(rows.map((s, i) => [s.member_id, String(bp[i] / 100)]));
}

/**
 * Add / edit expense bottom sheet. Pass `editing` to edit an existing expense.
 * Mount it only while open (`{adding && <AddExpenseSheet …/>}`) so every open starts fresh.
 */
export function AddExpenseSheet({
  editing,
  onClose,
  onSaved,
}: {
  editing?: ExpenseWithShares;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { flat, members, me } = useFlat();

  const [description, setDescription] = useState(editing?.description ?? "");
  const [amountText, setAmountText] = useState(editing ? (editing.amount_pence / 100).toFixed(2) : "");
  const [payerId, setPayerId] = useState(editing?.payer_id ?? me.id);
  const [included, setIncluded] = useState<Set<string>>(() => (editing ? includedFrom(editing) : new Set(members.map((m) => m.id))));
  const [splitType, setSplitType] = useState<SplitType>(editing?.split_type ?? "equal");
  const [inputs, setInputs] = useState<Record<string, string>>(() => (editing ? inputsFrom(editing, includedFrom(editing)) : {})); // per-member £ or % text
  const [repeat, setRepeat] = useState<"once" | Interval>("once");
  const [startDate, setStartDate] = useState(todayInput);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ─── Derived ───
  const amountPence = parsePounds(amountText);
  const participants = members.filter((m) => included.has(m.id));
  const values: Record<string, number> = Object.fromEntries(
    participants.map((m) => {
      const text = inputs[m.id]?.trim() ?? "";
      if (splitType === "equal" || text === "") return [m.id, 0];
      return [m.id, splitType === "amount" ? (parsePounds(text) ?? NaN) : Number(text)];
    }),
  );

  let shares: Record<string, number> | null = null;
  let splitProblem: string | null = null;
  if (amountPence && amountPence > 0) {
    try {
      shares = computeShares(amountPence, splitType, payerId, values);
    } catch (e) {
      splitProblem = e instanceof SplitError ? e.message : "Check the split.";
    }
  }
  const left = amountPence ? remaining(amountPence, splitType, values) : 0;
  // Why Save is disabled (split problems are explained by SplitStatus instead).
  const missing = !description.trim() ? "Add a label so flatmates know what this was for" : !amountPence ? "Enter an amount" : null;
  const canSave = description.trim() !== "" && shares !== null && !saving;

  // ─── Actions ───
  const toggle = (id: string) =>
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function save() {
    if (!canSave || !shares || amountPence === null) return;

    setSaving(true);
    setSaveError(null);
    try {
      const firstDueAt = startDate === todayInput() ? new Date().toISOString() : startOfDayIso(startDate); // today → due now
      const recurring = { payerId, description, amountPence, splitType, values, interval: repeat as Interval, firstDueAt };
      if (flat.id === DEMO_FLAT_ID) {
        // Demo flat: same actions against the in-memory store.
        if (editing) demoEditExpense(editing.id, me.id, { description, amountPence, payerId, splitType, shares });
        else if (repeat === "once") demoAddExpense({ flatId: flat.id, payerId, createdBy: me.id, description, amountPence, splitType, shares });
        else demoCreateRecurring(recurring);
      } else if (editing) {
        await editExpense(editing.id, me.id, { description, amountPence, payerId, splitType, shares });
      } else if (repeat === "once") {
        await addExpense({ flatId: flat.id, payerId, createdBy: me.id, description, amountPence, splitType, shares });
      } else {
        await createRecurringExpense({ flatId: flat.id, ...recurring });
      }
      onSaved?.();
      onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save the expense.");
    } finally {
      setSaving(false);
    }
  }

  // ─── Form ───
  return (
    <Sheet open onClose={onClose} title={editing ? "Edit expense" : "Add expense"}>
      <Input label="What for? *" placeholder="Tesco big shop" required maxLength={60} value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />
      <Input
        label="Amount"
        placeholder="£0.00"
        inputMode="decimal"
        className="text-2xl font-semibold"
        value={amountText}
        onChange={(e) => setAmountText(e.target.value)}
      />
      {amountText !== "" && amountPence === null && <p className="-mt-2 text-sm text-negative">Enter an amount like 12.50</p>}

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-muted">Paid by</span>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => setPayerId(m.id)}
              className={`flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium transition ${
                m.id === payerId ? "bg-accent text-accent-fg" : "bg-surface-2 text-foreground"
              }`}
            >
              <Avatar name={m.name} size={26} />
              {m.id === me.id ? "You" : m.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-muted">Split</span>
        <SegmentedControl
          options={[
            { value: "equal", label: "Equally" },
            { value: "amount", label: "By £" },
            { value: "percent", label: "By %" },
          ]}
          value={splitType}
          onChange={(t) => {
            setSplitType(t);
            setInputs({}); // £ and % values mean different things
          }}
        />
      </div>

      <List>
        {members.map((m) => {
          const isIn = included.has(m.id);
          return (
            <ListRow
              key={m.id}
              onClick={() => toggle(m.id)}
              leading={
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                    isIn ? "border-accent bg-accent text-accent-fg" : "border-border"
                  }`}
                >
                  {isIn && <Check size={14} strokeWidth={3} />}
                </span>
              }
              title={
                <span className={`inline-flex items-center gap-2 ${isIn ? "" : "text-muted"}`}>
                  <Avatar name={m.name} size={26} />
                  {m.id === me.id ? "You" : m.name}
                </span>
              }
              trailing={
                !isIn ? (
                  <span className="text-sm text-muted">Not in</span>
                ) : splitType === "equal" ? (
                  shares?.[m.id] !== undefined ? <Amount pence={shares[m.id]} /> : <span className="text-sm text-muted">—</span>
                ) : (
                  <input
                    inputMode="decimal"
                    placeholder={splitType === "amount" ? "£0.00" : "0%"}
                    value={inputs[m.id] ?? ""}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setInputs((prev) => ({ ...prev, [m.id]: e.target.value }))}
                    className="h-9 w-24 rounded-lg border border-border bg-background px-2 text-right tabular-nums outline-none focus:border-accent"
                  />
                )
              }
            />
          );
        })}
      </List>

      <SplitStatus splitType={splitType} amountPence={amountPence} left={left} problem={splitProblem} payerAbsorbs={shares !== null && !included.has(payerId) && (shares[payerId] ?? 0) > 0} />

      {saveError && <p className="text-sm text-negative">{saveError}</p>}

      {!editing && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted">Repeats</span>
          <SegmentedControl
            options={[
              { value: "once", label: "One-off" },
              { value: "weekly", label: "Weekly" },
              { value: "monthly", label: "Monthly" },
            ]}
            value={repeat}
            onChange={setRepeat}
          />
        </div>
      )}
      {!editing && repeat !== "once" && (
        <Input
          label="First bill on"
          type="date"
          min={todayInput()}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value || todayInput())}
        />
      )}

      <Button onClick={save} disabled={!canSave}>
        {editing
          ? saving
            ? "Saving…"
            : "Save changes"
          : saving
            ? "Adding…"
            : amountPence
              ? `Add ${formatPence(amountPence)}${repeat === "once" ? "" : ` ${repeat}`}`
              : "Add expense"}
      </Button>
      {editing && !missing && <p className="-mt-2 text-center text-xs text-muted">Everyone affected will see what you changed.</p>}
      {missing && <p className="-mt-2 text-center text-sm text-muted">{missing}</p>}
    </Sheet>
  );
}

/** The one-line status under the member list: what's left to assign, or what's wrong. */
function SplitStatus({
  splitType,
  amountPence,
  left,
  problem,
  payerAbsorbs,
}: {
  splitType: SplitType;
  amountPence: number | null;
  left: number;
  problem: string | null;
  payerAbsorbs: boolean;
}) {
  if (!amountPence) return null;
  if (splitType !== "equal" && left !== 0) {
    const text = splitType === "amount" ? formatPence(Math.abs(left)) : `${Math.abs(left)}%`;
    return <p className={`-mt-2 text-sm ${left < 0 ? "text-negative" : "text-muted"}`}>{left > 0 ? `${text} left to assign` : `${text} over`}</p>;
  }
  if (problem) return <p className="-mt-2 text-sm text-negative">{problem}</p>;
  if (payerAbsorbs) return <p className="-mt-2 text-sm text-muted">The payer covers the leftover penny.</p>;
  return null;
}

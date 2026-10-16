"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useFlat } from "@/lib/flat-context";
import { DEMO_FLAT_ID } from "@/lib/mock";
import { formatPence, parsePounds } from "@/lib/money";
import { Amount, Avatar, Button, Input, List, ListRow, SegmentedControl, Sheet } from "@/components/ui";
import type { SplitType } from "@/lib/types";
import { addExpense, computeShares, remaining, SplitError } from "./api";

/**
 * Add-expense bottom sheet. Mount it only while open (`{adding && <AddExpenseSheet …/>}`)
 * so every open starts with a fresh form.
 */
export function AddExpenseSheet({ onClose, onSaved }: { onClose: () => void; onSaved?: () => void }) {
  const { flat, members, me } = useFlat();

  const [description, setDescription] = useState("");
  const [amountText, setAmountText] = useState("");
  const [payerId, setPayerId] = useState(me.id);
  const [included, setIncluded] = useState<Set<string>>(() => new Set(members.map((m) => m.id)));
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [inputs, setInputs] = useState<Record<string, string>>({}); // per-member £ or % text
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
    if (flat.id === DEMO_FLAT_ID) return setSaveError("This is the demo flat. Create a real flat to save expenses.");

    setSaving(true);
    setSaveError(null);
    try {
      await addExpense({
        flatId: flat.id,
        payerId,
        createdBy: me.id,
        description,
        amountPence,
        splitType,
        shares,
      });
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
    <Sheet open onClose={onClose} title="Add expense">
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

      <Button onClick={save} disabled={!canSave}>
        {saving ? "Adding…" : amountPence ? `Add ${formatPence(amountPence)}` : "Add expense"}
      </Button>
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

"use client";

import { useEffect, useState } from "react";
import { Lock, PencilLine, Repeat, Trash2 } from "lucide-react";
import { useFlat } from "@/lib/flat-context";
import { DEMO_FLAT_ID } from "@/lib/mock";
import { formatPence } from "@/lib/money";
import { timeAgo } from "@/lib/dates";
import type { ExpenseChange } from "@/lib/types";
import { Amount, Avatar, Badge, Button, List, ListRow, Section, Sheet } from "@/components/ui";
import { cannotChange, deleteExpense, getExpenseChanges, type ExpenseWithShares } from "./api";
import { ChangeText } from "./ChangeText";
import { demoChanges } from "./demo";

const splitLabel = { equal: "Split equally", amount: "Split by amount", percent: "Split by percentage" } as const;

/** Breakdown of one expense, its change history, and Edit/Delete for its creator. */
export function ExpenseDetailSheet({
  expense,
  onClose,
  onEdit,
}: {
  expense: ExpenseWithShares;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { flat, me, memberName, realName } = useFlat();
  const isDemo = flat.id === DEMO_FLAT_ID;
  const shares = [...expense.expense_shares].sort((a, b) => b.amount_pence - a.amount_pence);
  const blocked = cannotChange(expense, me.id);

  const [history, setHistory] = useState<ExpenseChange[]>(isDemo ? demoChanges.filter((c) => c.expense_id === expense.id) : []);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refetch when the expense is edited (edited_at changes) while the sheet is open.
  useEffect(() => {
    if (isDemo) return;
    getExpenseChanges(expense.id).then(setHistory).catch(console.error);
  }, [expense.id, expense.edited_at, isDemo]);

  async function remove() {
    if (isDemo) return setError("This is the demo flat. Create a real flat to delete expenses.");
    setBusy(true);
    setError(null);
    try {
      await deleteExpense(expense.id, me.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete.");
      setBusy(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={expense.description}>
      <div className="flex flex-col items-center gap-2 py-2 text-center">
        <span className="text-4xl font-bold tabular-nums">{formatPence(expense.amount_pence)}</span>
        <span className="text-sm text-muted">
          {memberName(expense.payer_id)} paid · {timeAgo(expense.created_at)}
        </span>
        <div className="flex flex-wrap justify-center gap-1.5">
          <Badge>{splitLabel[expense.split_type]}</Badge>
          {expense.recurring_expense_id && (
            <Badge tone="accent">
              <Repeat size={12} /> Recurring
            </Badge>
          )}
          {expense.bounty_id && <Badge tone="warning">Chore buyout</Badge>}
          {expense.edited_at && <Badge tone="warning">Edited {timeAgo(expense.edited_at).toLowerCase()}</Badge>}
        </div>
      </div>

      <List>
        {shares.map((s) => (
          <ListRow
            key={s.member_id}
            leading={<Avatar name={realName(s.member_id)} size={32} />}
            title={memberName(s.member_id)}
            subtitle={
              s.member_id === expense.payer_id ? "paid · own share" : `owes ${memberName(expense.payer_id).replace(/^You$/, "you")}`
            }
            trailing={<Amount pence={s.amount_pence} />}
          />
        ))}
      </List>

      {history.length > 0 && (
        <Section title="Changes">
          <List>
            {history.map((c) => (
              <ListRow
                key={c.id}
                leading={<PencilLine size={16} className="text-warning" />}
                title={
                  <span className="whitespace-normal text-sm font-normal [&_b]:font-semibold">
                    <ChangeText change={c} withName={false} />
                  </span>
                }
                subtitle={timeAgo(c.created_at)}
              />
            ))}
          </List>
        </Section>
      )}

      <p className="text-center text-xs text-muted">Added by {memberName(expense.created_by)}</p>

      {error && <p className="text-sm text-negative">{error}</p>}
      {blocked ? (
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
          <Lock size={12} /> {blocked}
        </p>
      ) : confirmingDelete ? (
        <>
          <p className="text-center text-sm">Delete it? Everyone in the split will see that you did.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setConfirmingDelete(false)} disabled={busy}>
              Keep
            </Button>
            <Button variant="danger" onClick={remove} disabled={busy}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onEdit}>
            <PencilLine size={16} /> Edit
          </Button>
          <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
            <Trash2 size={16} /> Delete
          </Button>
        </div>
      )}
    </Sheet>
  );
}

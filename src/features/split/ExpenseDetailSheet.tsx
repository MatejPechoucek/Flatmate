"use client";

import { Repeat } from "lucide-react";
import { useFlat } from "@/lib/flat-context";
import { formatPence } from "@/lib/money";
import { timeAgo } from "@/lib/dates";
import { Amount, Avatar, Badge, List, ListRow, Sheet } from "@/components/ui";
import type { ExpenseWithShares } from "./api";

const splitLabel = { equal: "Split equally", amount: "Split by amount", percent: "Split by percentage" } as const;

/** Read-only breakdown of one expense. Edit/Delete + change history arrive in task 7. */
export function ExpenseDetailSheet({ expense, onClose }: { expense: ExpenseWithShares; onClose: () => void }) {
  const { memberName, realName } = useFlat();
  const shares = [...expense.expense_shares].sort((a, b) => b.amount_pence - a.amount_pence);

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

      {expense.created_by && expense.created_by !== expense.payer_id && (
        <p className="text-center text-xs text-muted">Added by {memberName(expense.created_by)}</p>
      )}
    </Sheet>
  );
}

"use client";

import { useState } from "react";
import { Receipt, Repeat } from "lucide-react";
import { useFlat } from "@/lib/flat-context";
import { Amount, Avatar, Badge, Button, EmptyState, Fab, List, ListRow, Section } from "@/components/ui";
import { timeAgo } from "@/lib/dates";
import { shareOf, type ExpenseWithShares } from "./api";
import { useExpenses } from "./useExpenses";
import { useSettlements } from "./useSettlements";
import { BalancesSection } from "./BalancesSection";
import { AddExpenseSheet } from "./AddExpenseSheet";
import { ExpenseDetailSheet } from "./ExpenseDetailSheet";

// Entry point for the Split tab (/flat/[flatId]/split).
export function SplitScreen() {
  const { expenses, loading, error, reload } = useExpenses();
  const { settlements, error: settlementsError } = useSettlements();
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const opened = expenses?.find((e) => e.id === openId);

  return (
    <div className="flex flex-col gap-6">
      <BalancesSection expenses={expenses} settlements={settlements} error={error ?? settlementsError} />

      <Section title="Expenses">
        {loading ? (
          <EmptyState>Loading expenses…</EmptyState>
        ) : error ? (
          <EmptyState>
            {error}
            <Button size="sm" variant="ghost" onClick={reload}>
              Try again
            </Button>
          </EmptyState>
        ) : expenses!.length === 0 ? (
          <EmptyState icon={<Receipt className="text-muted" />}>No expenses yet. Add the first one with the button below.</EmptyState>
        ) : (
          <List>
            {expenses!.map((e) => (
              <ExpenseRow key={e.id} expense={e} onOpen={() => setOpenId(e.id)} />
            ))}
          </List>
        )}
      </Section>

      <Fab label="Add expense" onClick={() => setAdding(true)} />
      {adding && <AddExpenseSheet onClose={() => setAdding(false)} onSaved={reload} />}
      {opened && <ExpenseDetailSheet expense={opened} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function ExpenseRow({ expense: e, onOpen }: { expense: ExpenseWithShares; onOpen: () => void }) {
  const { me, memberName, realName } = useFlat();
  const myShare = shareOf(e, me.id);

  return (
    <ListRow
      onClick={onOpen}
      leading={<Avatar name={realName(e.payer_id)} />}
      title={e.description}
      subtitle={
        <span className="inline-flex items-center gap-1.5">
          {e.recurring_expense_id && <Repeat size={13} className="shrink-0" />}
          {e.bounty_id && <Badge tone="warning">Buyout</Badge>}
          {e.edited_at && <Badge tone="warning">Edited</Badge>}
          <span className="truncate">
            {memberName(e.payer_id)} paid · {timeAgo(e.created_at)}
          </span>
        </span>
      }
      trailing={
        <div>
          <Amount pence={e.amount_pence} />
          <div className="text-xs text-muted">
            {myShare > 0 ? (
              <>
                your share <Amount pence={myShare} className="font-normal" />
              </>
            ) : (
              "not included"
            )}
          </div>
        </div>
      }
    />
  );
}

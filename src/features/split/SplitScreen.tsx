"use client";

import { useState } from "react";
import { HandCoins, Receipt, Repeat } from "lucide-react";
import { useFlat } from "@/lib/flat-context";
import { Amount, Avatar, Badge, Button, EmptyState, Fab, List, ListRow, Section } from "@/components/ui";
import { timeAgo } from "@/lib/dates";
import type { Settlement } from "@/lib/types";
import { shareOf, type ExpenseWithShares, type Transfer } from "./api";
import { useExpenses } from "./useExpenses";
import { useSettlements } from "./useSettlements";
import { BalancesSection } from "./BalancesSection";
import { AddExpenseSheet } from "./AddExpenseSheet";
import { ExpenseDetailSheet } from "./ExpenseDetailSheet";
import { SettleUpSheet } from "./SettleUpSheet";

// Entry point for the Split tab (/flat/[flatId]/split).
export function SplitScreen() {
  const { expenses, loading, error, reload } = useExpenses();
  const { settlements, error: settlementsError, reload: reloadSettlements } = useSettlements();
  const [adding, setAdding] = useState(false);
  const [settling, setSettling] = useState<Transfer | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const opened = expenses?.find((e) => e.id === openId);

  // Expenses and payments in one timeline, newest first.
  const history: HistoryItem[] = [
    ...(expenses ?? []).map((e) => ({ kind: "expense" as const, at: e.created_at, expense: e })),
    ...(settlements ?? []).map((s) => ({ kind: "payment" as const, at: s.created_at, payment: s })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="flex flex-col gap-6">
      <BalancesSection expenses={expenses} settlements={settlements} error={error ?? settlementsError} onSettle={setSettling} />

      <Section title="History">
        {loading ? (
          <EmptyState>Loading expenses…</EmptyState>
        ) : error ? (
          <EmptyState>
            {error}
            <Button size="sm" variant="ghost" onClick={reload}>
              Try again
            </Button>
          </EmptyState>
        ) : history.length === 0 ? (
          <EmptyState icon={<Receipt className="text-muted" />}>No expenses yet. Add the first one with the button below.</EmptyState>
        ) : (
          <List>
            {history.map((item) =>
              item.kind === "expense" ? (
                <ExpenseRow key={item.expense.id} expense={item.expense} onOpen={() => setOpenId(item.expense.id)} />
              ) : (
                <PaymentRow key={item.payment.id} payment={item.payment} />
              ),
            )}
          </List>
        )}
      </Section>

      <Fab label="Add expense" onClick={() => setAdding(true)} />
      {adding && <AddExpenseSheet onClose={() => setAdding(false)} onSaved={reload} />}
      {opened && <ExpenseDetailSheet expense={opened} onClose={() => setOpenId(null)} />}
      {settling && <SettleUpSheet transfer={settling} onClose={() => setSettling(null)} onSaved={reloadSettlements} />}
    </div>
  );
}

type HistoryItem =
  | { kind: "expense"; at: string; expense: ExpenseWithShares }
  | { kind: "payment"; at: string; payment: Settlement };

function PaymentRow({ payment: p }: { payment: Settlement }) {
  const { memberName, realName } = useFlat();
  const to = memberName(p.to_member);
  return (
    <ListRow
      leading={
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-positive-soft text-positive">
          <HandCoins size={18} />
        </span>
      }
      title={`${memberName(p.from_member)} paid ${to === "You" ? "you" : realName(p.to_member)}`}
      subtitle={`Payment · ${timeAgo(p.created_at)}`}
      trailing={<Amount pence={p.amount_pence} className="text-positive" />}
    />
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

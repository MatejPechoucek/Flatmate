"use client";

import { useState } from "react";
import { ArrowRight, CircleHelp, PartyPopper } from "lucide-react";
import { useFlat } from "@/lib/flat-context";
import type { Settlement } from "@/lib/types";
import { Amount, Avatar, Button, EmptyState, List, ListRow, Section } from "@/components/ui";
import { SplitHelpSheet } from "./SplitHelpSheet";
import { balancesFor, netBalances, simplifyDebts, type ExpenseWithShares, type Transfer } from "./api";

/**
 * "Who pays whom" from the simplified plan. Computed client-side from the already-loaded
 * expenses + settlements, so it updates live with them.
 */
export function BalancesSection({
  expenses,
  settlements,
  error,
  onSettle,
}: {
  expenses: ExpenseWithShares[] | null;
  settlements: Settlement[] | null;
  error?: string | null;
  onSettle?: (transfer: Transfer) => void;
}) {
  const { me, memberName, realName } = useFlat();
  const [showAll, setShowAll] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  if (!expenses || !settlements) {
    return (
      <Section title="Balances">
        <EmptyState>{error ?? "Working out balances…"}</EmptyState>
      </Section>
    );
  }

  const plan = simplifyDebts(netBalances(expenses, settlements));
  // What I owe first, then biggest amounts first.
  const mine = balancesFor(plan, me.id).sort(
    (a, b) => Number(b.pence < 0) - Number(a.pence < 0) || Math.abs(b.pence) - Math.abs(a.pence),
  );

  return (
    <Section
      title="Balances"
      action={
        <div className="flex items-center gap-3">
          {plan.length > 0 && (
            <button className="text-xs font-medium text-accent" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Just mine" : `All flat payments (${plan.length})`}
            </button>
          )}
          <button onClick={() => setHelpOpen(true)} className="text-muted hover:text-accent" aria-label="How Split works">
            <CircleHelp size={18} />
          </button>
        </div>
      }
    >
      {helpOpen && <SplitHelpSheet onClose={() => setHelpOpen(false)} />}
      {showAll ? (
        <List>
          {plan.map((t) => (
            <ListRow
              key={`${t.from}-${t.to}`}
              leading={<Avatar name={realName(t.from)} />}
              title={
                <span className="inline-flex items-center gap-1.5">
                  {memberName(t.from)} <ArrowRight size={14} className="text-muted" /> {memberName(t.to)}
                </span>
              }
              trailing={<Amount pence={t.pence} />}
            />
          ))}
        </List>
      ) : plan.length === 0 ? (
        <EmptyState icon={<PartyPopper className="text-positive" />}>All settled up. Nobody owes anything.</EmptyState>
      ) : mine.length === 0 ? (
        <EmptyState>You&apos;re all square. Other flatmates still owe each other.</EmptyState>
      ) : (
        <List>
          {mine.map((b) => {
            const iPay = b.pence < 0;
            return (
              <ListRow
                key={b.member_id}
                leading={<Avatar name={realName(b.member_id)} />}
                title={iPay ? `You pay ${memberName(b.member_id)}` : `${memberName(b.member_id)} pays you`}
                trailing={
                  <div className="flex items-center gap-3">
                    <Amount pence={b.pence} signed />
                    {iPay && (
                      <Button size="sm" onClick={() => onSettle?.({ from: me.id, to: b.member_id, pence: -b.pence })}>
                        Settle up
                      </Button>
                    )}
                  </div>
                }
              />
            );
          })}
        </List>
      )}
    </Section>
  );
}

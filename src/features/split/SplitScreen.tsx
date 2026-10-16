"use client";

import { useState } from "react";
import { Repeat } from "lucide-react";
import { useFlat } from "@/lib/flat-context";
import { Amount, Avatar, Badge, Button, Fab, Input, List, ListRow, Section, SegmentedControl, Sheet } from "@/components/ui";
import { demoBalances, demoExpenses } from "@/lib/mock";
import { timeAgo } from "@/lib/dates";
import type { SplitType } from "@/lib/types";

// Entry point for the Split tab (/flat/[flatId]/split).
// Skeleton: renders demo data. TODO(split): load from Supabase via ./api and wire the sheet.
export function SplitScreen() {
  const { memberName, realName } = useFlat();
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <Section title="Balances">
        <List>
          {demoBalances.map((b) => (
            <ListRow
              key={b.member_id}
              leading={<Avatar name={realName(b.member_id)} />}
              title={memberName(b.member_id)}
              subtitle={b.pence > 0 ? "owes you" : b.pence < 0 ? "you owe" : "settled up"}
              trailing={
                <div className="flex items-center gap-3">
                  <Amount pence={b.pence} signed />
                  {b.pence < 0 && <Button size="sm">Settle up</Button>}
                </div>
              }
            />
          ))}
        </List>
      </Section>

      <Section title="Expenses">
        <List>
          {demoExpenses.map((e) => (
            <ListRow
              key={e.id}
              leading={<Avatar name={realName(e.payer_id)} />}
              title={
                <span className="inline-flex items-center gap-1.5">
                  {e.description}
                  {e.recurring_expense_id && <Repeat size={14} className="text-muted" />}
                  {e.bounty_id && <Badge tone="warning">Buyout</Badge>}
                </span>
              }
              subtitle={`${memberName(e.payer_id)} paid · ${timeAgo(e.created_at)}`}
              trailing={
                <div>
                  <Amount pence={e.amount_pence} />
                  <div className="text-xs text-muted">your share <Amount pence={e.your_share_pence} className="font-normal" /></div>
                </div>
              }
            />
          ))}
        </List>
      </Section>

      <Fab label="Add expense" onClick={() => setAdding(true)} />
      <AddExpenseSheet open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function AddExpenseSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { members } = useFlat();
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [recurring, setRecurring] = useState<"once" | "weekly" | "monthly">("once");

  return (
    <Sheet open={open} onClose={onClose} title="Add expense">
      <Input label="What for?" placeholder="Tesco big shop" />
      <Input label="Amount" placeholder="£0.00" inputMode="decimal" className="text-2xl font-semibold" />
      <SegmentedControl
        options={[
          { value: "equal", label: "Equal" },
          { value: "amount", label: "£" },
          { value: "percent", label: "%" },
        ]}
        value={splitType}
        onChange={setSplitType}
      />
      <List>
        {members.map((m) => (
          <ListRow
            key={m.id}
            leading={<Avatar name={m.name} size={32} />}
            title={m.name}
            trailing={
              splitType === "equal" ? (
                <span className="text-sm text-muted">—</span>
              ) : (
                <input
                  placeholder={splitType === "amount" ? "£0.00" : "0%"}
                  className="h-9 w-20 rounded-lg border border-border bg-background px-2 text-right outline-none focus:border-accent"
                />
              )
            }
          />
        ))}
      </List>
      <SegmentedControl
        options={[
          { value: "once", label: "One-off" },
          { value: "weekly", label: "Weekly" },
          { value: "monthly", label: "Monthly" },
        ]}
        value={recurring}
        onChange={setRecurring}
      />
      <Button onClick={onClose}>Add expense</Button>
    </Sheet>
  );
}

"use client";

import { useState } from "react";
import { Check, Coins, Repeat } from "lucide-react";
import { useFlat } from "@/lib/flat-context";
import {
  Amount,
  Avatar,
  Badge,
  Button,
  Card,
  Fab,
  Input,
  List,
  ListRow,
  ProgressBar,
  Section,
  SegmentedControl,
  Sheet,
  WeightDots,
} from "@/components/ui";
import { demoBounties, demoChores, demoFairness, demoTasks } from "@/lib/mock";
import { dueLabel } from "@/lib/dates";

// Entry point for the Chores tab (/flat/[flatId]/chores).
// Skeleton: renders demo data. TODO(chores): load from Supabase via ./api and wire actions.
export function ChoresScreen() {
  const { me, memberName, realName } = useFlat();
  const [adding, setAdding] = useState(false);
  const choreOf = (id: string) => demoChores.find((c) => c.id === id)!;
  const open = demoTasks.filter((t) => t.status === "open");
  const mine = open.filter((t) => t.assigned_to === me.id);
  const others = open.filter((t) => t.assigned_to !== me.id);
  const maxPoints = Math.max(...demoFairness.map((f) => f.points));

  return (
    <div className="flex flex-col gap-6">
      <Section title="Your chores">
        <List>
          {mine.map((t) => {
            const chore = choreOf(t.chore_id);
            const due = dueLabel(t.due_at);
            return (
              <ListRow
                key={t.id}
                leading={
                  <button
                    className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-border text-transparent transition hover:border-positive hover:text-positive"
                    aria-label="Mark done"
                  >
                    <Check size={18} strokeWidth={3} />
                  </button>
                }
                title={chore.title}
                subtitle={
                  <span className="inline-flex items-center gap-2">
                    <WeightDots weight={chore.weight} />
                    <span className={due.overdue ? "text-negative" : ""}>{due.text}</span>
                  </span>
                }
                trailing={
                  <Button size="sm" variant="secondary">
                    <Coins size={14} /> £{chore.weight}
                  </Button>
                }
              />
            );
          })}
        </List>
      </Section>

      <Section title="Bounty board">
        <List>
          {demoBounties.map((b) => {
            const t = demoTasks.find((x) => x.id === b.task_id)!;
            return (
              <ListRow
                key={b.id}
                leading={
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-warning-soft text-warning">
                    <Coins size={18} />
                  </span>
                }
                title={choreOf(t.chore_id).title}
                subtitle={<>{memberName(b.offered_by)} pays <Amount pence={b.amount_pence} className="text-warning" /></>}
                trailing={<Button size="sm">Take it</Button>}
              />
            );
          })}
        </List>
      </Section>

      <Section title="Everyone else">
        <List>
          {others.map((t) => {
            const chore = choreOf(t.chore_id);
            const due = dueLabel(t.due_at);
            return (
              <ListRow
                key={t.id}
                leading={<Avatar name={realName(t.assigned_to)} />}
                title={chore.title}
                subtitle={memberName(t.assigned_to)}
                trailing={<Badge tone={due.overdue ? "negative" : "neutral"}>{due.text}</Badge>}
              />
            );
          })}
        </List>
      </Section>

      <Section title="Fairness · last 28 days">
        <Card className="flex flex-col gap-4">
          {demoFairness.map((f) => (
            <div key={f.member_id} className="flex items-center gap-3">
              <Avatar name={realName(f.member_id)} size={28} />
              <div className="flex-1">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium">{memberName(f.member_id)}</span>
                  <span className="tabular-nums text-muted">{f.points} pts</span>
                </div>
                <ProgressBar value={f.points} max={maxPoints} />
              </div>
            </div>
          ))}
          <p className="text-xs text-muted">New chores go to whoever has the fewest points.</p>
        </Card>
      </Section>

      <Section title="All chores">
        <List>
          {demoChores.map((c) => (
            <ListRow
              key={c.id}
              title={
                <span className="inline-flex items-center gap-1.5">
                  {c.title}
                  {c.kind === "recurring" && <Repeat size={14} className="text-muted" />}
                </span>
              }
              subtitle={c.kind === "recurring" ? `Every ${c.interval_days} days` : "One-off"}
              trailing={<WeightDots weight={c.weight} />}
            />
          ))}
        </List>
      </Section>

      <Fab label="Add chore" onClick={() => setAdding(true)} />
      <AddChoreSheet open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function AddChoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<"recurring" | "one_off">("recurring");
  const [weight, setWeight] = useState(2);

  return (
    <Sheet open={open} onClose={onClose} title="Add chore">
      <Input label="Chore" placeholder="Take the bins out" />
      <SegmentedControl
        options={[
          { value: "recurring", label: "Recurring" },
          { value: "one_off", label: "One-off" },
        ]}
        value={kind}
        onChange={setKind}
      />
      {kind === "recurring" && <Input label="Every how many days?" placeholder="7" inputMode="numeric" />}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-muted">Effort</span>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((w) => (
            <button
              key={w}
              onClick={() => setWeight(w)}
              className={`h-12 rounded-xl font-semibold transition ${w === weight ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted"}`}
            >
              {w}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted">Flatmates have 24h to object to the weight.</span>
      </div>
      <Button onClick={onClose}>Add chore</Button>
    </Sheet>
  );
}

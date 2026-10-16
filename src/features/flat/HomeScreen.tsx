"use client";

import Link from "next/link";
import { ChevronRight, Coins } from "lucide-react";
import { useFlat } from "@/lib/flat-context";
import { Amount, Avatar, Badge, List, ListRow, Section, WeightDots } from "@/components/ui";
import { demoActivity, demoBalances, demoBounties, demoChores, demoTasks } from "@/lib/mock";
import { dueLabel, timeAgo } from "@/lib/dates";
import { formatPence } from "@/lib/money";

// Home: a summary of both features. Each card links into its tab.
// TODO: replace demo* data with real queries once Split and Chores expose them.
export function HomeScreen() {
  const { flat, me, memberName, realName } = useFlat();
  const net = demoBalances.reduce((sum, b) => sum + b.pence, 0);
  const myTasks = demoTasks.filter((t) => t.assigned_to === me.id && t.status === "open");
  const choreOf = (id: string) => demoChores.find((c) => c.id === id)!;

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/flat/${flat.id}/split`}>
        <div className="flex items-center justify-between rounded-2xl bg-accent p-5 text-accent-fg shadow-lg shadow-accent/20">
          <div>
            <p className="text-sm opacity-80">{net >= 0 ? "You're owed" : "You owe"}</p>
            <p className="text-3xl font-bold tabular-nums">{formatPence(Math.abs(net))}</p>
          </div>
          <ChevronRight className="opacity-80" />
        </div>
      </Link>

      <Section title="Your next chores">
        <List>
          {myTasks.map((t) => {
            const chore = choreOf(t.chore_id);
            const due = dueLabel(t.due_at);
            return (
              <ListRow
                key={t.id}
                title={chore.title}
                subtitle={<WeightDots weight={chore.weight} />}
                trailing={<Badge tone={due.overdue ? "negative" : "neutral"}>{due.text}</Badge>}
              />
            );
          })}
        </List>
      </Section>

      {demoBounties.length > 0 && (
        <Section title="Up for grabs">
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
                  subtitle={`${memberName(b.offered_by)} will pay`}
                  trailing={<Amount pence={b.amount_pence} className="text-warning" />}
                />
              );
            })}
          </List>
        </Section>
      )}

      <Section title="Activity">
        <List>
          {demoActivity.map((a) => (
            <ListRow
              key={a.id}
              leading={<Avatar name={realName(a.member_id)} />}
              title={
                <span className="font-normal">
                  <span className="font-medium">{memberName(a.member_id)}</span> {a.text}
                </span>
              }
              subtitle={timeAgo(a.at)}
            />
          ))}
        </List>
      </Section>
    </div>
  );
}

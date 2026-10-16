"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Coins, Receipt } from "lucide-react";
import { useFlat } from "@/lib/flat-context";
import { Amount, Avatar, Badge, EmptyState, List, ListRow, Section, Skeleton, WeightDots } from "@/components/ui";
import { DEMO_FLAT_ID } from "@/lib/mock";
import { useRealtime } from "@/lib/useRealtime";
import { dueLabel, timeAgo } from "@/lib/dates";
import { formatPence } from "@/lib/money";
import type { Bounty, Chore, ChoreTask } from "@/lib/types";
import { balancesFor, getBalances, netBalances, simplifyDebts } from "@/features/split/api";
import { getDemoExpenses, getDemoSettlements } from "@/features/split/demoStore";
import { getChoreBoard } from "@/features/chores/api";
import { demoChoreBoard } from "@/features/chores/demoStore";
import type { ChoreBoard } from "@/features/chores/types";
import { getActivity, type ActivityItem } from "./api";

type TaskWithChore = ChoreTask & { chore: Chore };
type BountyWithTask = Bounty & { task: ChoreTask; chore: Chore };
type FeedItem = { id: string; member_id: string; text: string; at: string; icon: "expense" | "chore" };

interface HomeData {
  net: number;
  myTasks: TaskWithChore[];
  bounties: BountyWithTask[];
  activity: FeedItem[];
}

/** My open tasks and the open bounties, from one chore board read. */
function fromBoard(board: ChoreBoard, meId: string): Pick<HomeData, "myTasks" | "bounties"> {
  const choreOf = (id: string) => board.chores.find((c) => c.id === id)!;
  return {
    myTasks: board.tasks.filter((t) => t.status === "open" && t.assigned_to === meId).map((t) => ({ ...t, chore: choreOf(t.chore_id) })),
    bounties: board.bounties.flatMap((b) => {
      const task = board.tasks.find((t) => t.id === b.task_id);
      return b.status === "open" && task ? [{ ...b, task, chore: choreOf(task.chore_id) }] : [];
    }),
  };
}

function toFeed(items: ActivityItem[]): FeedItem[] {
  return items.map((a) => ({
    id: a.id,
    member_id: a.member_id,
    at: a.at,
    icon: a.kind,
    text: a.kind === "expense" ? `added ${a.expense.description} · ${formatPence(a.expense.amount_pence)}` : `did ${a.title}`,
  }));
}

/** Demo flat: read the same in-memory stores Split and Chores use, so every tab agrees. */
const demoData = (meId: string): HomeData => {
  const expenses = getDemoExpenses().filter((e) => !e.deleted_at);
  const board = demoChoreBoard();
  const activity: ActivityItem[] = [
    ...expenses.map((e) => ({ id: `e:${e.id}`, kind: "expense" as const, member_id: e.payer_id, at: e.created_at, expense: e })),
    ...board.tasks
      .filter((t) => t.status === "done")
      .map((t) => ({ id: `t:${t.id}`, kind: "chore" as const, member_id: t.completed_by ?? "", at: t.completed_at ?? t.created_at, title: t.title })),
  ];
  return {
    net: balancesFor(simplifyDebts(netBalances(expenses, getDemoSettlements())), meId).reduce((sum, b) => sum + b.pence, 0),
    ...fromBoard(board, meId),
    activity: toFeed(activity.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 15)),
  };
};

/** Run a teammate's query; until it's implemented (throws TODO) fall back quietly. */
async function soft<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch (err) {
    console.info("[home] using fallback:", err instanceof Error ? err.message : err);
    return fallback;
  }
}

const emptyBoard: ChoreBoard = { flat: { id: "", name: "", buyout_rate_pence: 0 }, members: [], chores: [], tasks: [], bounties: [] };

// Home: a summary of both features. Each card links into its tab.
export function HomeScreen() {
  const { flat, me, memberName, realName } = useFlat();
  const isDemo = flat.id === DEMO_FLAT_ID;
  const [data, setData] = useState<HomeData | null>(null);

  const load = useCallback(async () => {
    // Demo data is built in the browser only (never on the server), so dates can't mismatch on hydration.
    if (isDemo) return setData(demoData(me.id));
    const [balances, board, activity] = await Promise.all([
      soft(getBalances(flat.id, me.id), []),
      soft(getChoreBoard(flat.id, me.id), emptyBoard),
      soft(getActivity(flat.id), []),
    ]);
    setData({ net: balances.reduce((sum, b) => sum + b.pence, 0), ...fromBoard(board, me.id), activity: toFeed(activity) });
  }, [flat.id, me.id, isDemo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch from Supabase
    load();
  }, [load]);

  useRealtime(flat.id, isDemo ? [] : ["expenses", "settlements", "chore_tasks", "bounties"], load);

  if (!data) return <HomeSkeleton />;
  const { net, myTasks, bounties, activity } = data;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/flat/${flat.id}/split`}
        className="flex items-end justify-between rounded-3xl bg-surface p-6 transition active:scale-[0.98]"
      >
        <div>
          <p className="text-sm font-medium text-muted">{net === 0 ? "You're all square" : net > 0 ? "You're owed" : "You owe"}</p>
          <Amount
            pence={net}
            className={`mt-1 block text-5xl font-bold tracking-tight ${net > 0 ? "text-positive" : net < 0 ? "text-negative" : ""}`}
          />
        </div>
        <span className="flex items-center gap-0.5 pb-1.5 text-sm font-medium text-accent">
          Balances <ChevronRight size={18} />
        </span>
      </Link>

      {/* Desktop: chores + bounties on the left, activity on the right. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-6">
          <Section
            title="Your next chores"
            action={
              <Link href={`/flat/${flat.id}/chores`} className="text-sm font-medium text-accent">
                All chores
              </Link>
            }
          >
            {myTasks.length === 0 ? (
              <EmptyState>Nothing on your list. Enjoy it.</EmptyState>
            ) : (
              <List>
                {myTasks.map((t) => {
                  const due = dueLabel(t.due_at);
                  return (
                    <ListRow
                      key={t.id}
                      title={t.chore.title}
                      subtitle={<WeightDots weight={t.chore.weight} />}
                      trailing={<Badge tone={due.overdue ? "negative" : "neutral"}>{due.text}</Badge>}
                    />
                  );
                })}
              </List>
            )}
          </Section>

          {bounties.length > 0 && (
            <Section title="Up for grabs">
              <List>
                {bounties.map((b) => (
                  <Link key={b.id} href={`/flat/${flat.id}/chores`} className="block">
                    <ListRow
                      leading={
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-warning-soft text-warning">
                          <Coins size={18} />
                        </span>
                      }
                      title={b.chore.title}
                      subtitle={`${memberName(b.offered_by)} will pay`}
                      trailing={<Amount pence={b.amount_pence} className="text-warning" />}
                    />
                  </Link>
                ))}
              </List>
            </Section>
          )}
        </div>

        <Section title="Activity">
          {activity.length === 0 ? (
            <EmptyState icon={<Receipt size={20} />}>Add an expense or finish a chore and it&apos;ll show up here.</EmptyState>
          ) : (
            <List>
              {activity.map((a) => (
                <ListRow
                  key={a.id}
                  leading={<Avatar name={realName(a.member_id)} />}
                  title={
                    <span className="font-normal">
                      <span className="font-medium">{memberName(a.member_id)}</span> {a.text}
                    </span>
                  }
                  subtitle={timeAgo(a.at)}
                  trailing={a.icon === "chore" && <CheckCircle2 size={18} className="text-positive" />}
                />
              ))}
            </List>
          )}
        </Section>
      </div>
    </div>
  );
}

/** Same shape as the real Home, so nothing jumps when data lands. */
function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-32 rounded-3xl" />
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-2.5">
          <Skeleton className="ml-1 h-3 w-28" />
          <Skeleton className="h-36 rounded-3xl" />
        </div>
        <div className="flex flex-col gap-2.5">
          <Skeleton className="ml-1 h-3 w-20" />
          <Skeleton className="h-52 rounded-3xl" />
        </div>
      </div>
    </div>
  );
}

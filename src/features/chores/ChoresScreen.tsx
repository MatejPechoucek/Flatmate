"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { Check, Coins, Repeat } from "lucide-react";
import { useFlat } from "@/lib/flat-context";
import { useRealtime } from "@/lib/useRealtime";
import { dueLabel, timeAgo } from "@/lib/dates";
import { formatPence } from "@/lib/money";
import { Amount, Avatar, Badge, Button, Card, EmptyState, Fab, Input, List, ListRow, ProgressBar, Section, SegmentedControl, Sheet, WeightDots } from "@/components/ui";
import { acceptBounty, cancelBounty, catchUpChores, completeTask, createChore, getChoreBoard, offerBounty } from "./api";
import { demoAcceptBounty, demoCancelBounty, demoChoreBoard, demoCompleteTask, demoCreateChore, demoOfferBounty, getDemoChoreState, subscribeDemoChores } from "./demoStore";
import type { ChoreBoard, MutationResult, Task } from "./types";

/** Same calls as ./api, but against the in-memory demo store (see demoStore). */
const demoOps = {
  getChoreBoard: async () => demoChoreBoard(),
  completeTask: async (taskId: string, memberId: string) => demoCompleteTask(taskId, memberId),
  offerBounty: async (taskId: string, memberId: string) => ({ mutation: demoOfferBounty(taskId, memberId) }),
  acceptBounty: async (bountyId: string, memberId: string) => demoAcceptBounty(bountyId, memberId),
  cancelBounty: async (bountyId: string, memberId: string) => demoCancelBounty(bountyId, memberId),
  createChore: async (input: Parameters<typeof createChore>[0]) => ({ mutation: demoCreateChore(input) }),
};
const realOps = { getChoreBoard, completeTask, offerBounty, acceptBounty, cancelBounty, createChore };

export function ChoresScreen() {
  const { flat, me } = useFlat();
  return <ChoresTab key={`${flat.id}:${me.id}`} flatId={flat.id} memberId={me.id} />;
}

/** Identity comes from the host. onMutation can invalidate platform balance/home caches. */
export function ChoresTab({ flatId, memberId, onMutation }: {
  flatId: string; memberId: string; onMutation?: (result: MutationResult) => void;
}) {
  const [board, setBoard] = useState<ChoreBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [notice, setNotice] = useState("");
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<"mine" | "all">("mine");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const request = useRef(0);
  const demo = flatId === "demo";
  const ops = demo ? demoOps : realOps;
  // Demo flat: re-read the board whenever the in-memory store changes.
  const demoState = useSyncExternalStore(subscribeDemoChores, getDemoChoreState, getDemoChoreState);

  const reload = useCallback(async () => {
    const current = ++request.current;
    try {
      const next = await (demo ? demoOps : realOps).getChoreBoard(flatId, memberId);
      if (current === request.current) { setBoard(next); setNow(Date.now()); setLoadError(null); }
    } catch (e) {
      if (current === request.current) setLoadError(e instanceof Error ? e.message : "Could not load chores.");
    }
  }, [demo, flatId, memberId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- demo board comes from the in-memory store
    if (demo) void reload();
  }, [demo, demoState, reload]);

  useEffect(() => {
    if (demo) return;
    // Initial fetch, catch-up on return, and a fallback for missed Realtime messages.
    const refresh = async () => {
      try { await catchUpChores(flatId); }
      catch (e) { setError(e instanceof Error ? e.message : "Could not catch up recurring chores."); }
      await reload();
    };
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
    const focus = () => { void refresh(); };
    window.addEventListener("focus", focus);
    return () => {
      // This is a request sequence, not a DOM ref: invalidate in-flight responses.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++request.current; clearInterval(timer); window.removeEventListener("focus", focus); };
  }, [demo, flatId, reload]);

  useRealtime(flatId, demo ? [] : ["chores", "chore_tasks", "bounties", "members"], reload);

  async function mutate(action: () => Promise<MutationResult>, message: string) {
    if (pending.current) return false;
    pending.current = true; setBusy(true); setError(null); setNotice("");
    try {
      const result = await action();
      setNotice(message);
      await reload();
      onMutation?.(result);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "That change could not be saved. Please retry.");
      await reload(); // A concurrent acceptance may have changed the available controls.
      return false;
    } finally { pending.current = false; setBusy(false); }
  }

  const displayError = error || loadError;
  if (!board) return <div role={displayError ? "alert" : "status"} className="text-sm text-muted">{displayError || "Loading chores…"}{displayError && <Button variant="ghost" onClick={reload}>Retry</Button>}</div>;
  const name = (id: string | null) => board.members.find(m => m.id === id)?.name ?? "Former flatmate";
  const tasks = board.tasks.filter(t => view === "all" || t.assigned_to === memberId);
  const maxPoints = Math.max(1, ...board.members.map(m => m.fairness_score));
  const openOffers = board.bounties.filter(b => b.status === "open");
  const accepted = board.bounties.filter(b => b.status === "accepted");

  function taskRow(t: Task) {
    const bounty = board!.bounties.find(b => b.task_id === t.id);
    const done = t.status === "done";
    // The shared helper rounds dates; use the actual timestamp for overdue state.
    const due = !done && t.due_at && new Date(t.due_at).getTime() < now
      ? { text: "Overdue", overdue: true } : dueLabel(t.due_at);
    return <article key={t.id} aria-label={`${t.title} task`}>
      <ListRow
        leading={<Avatar name={name(t.assigned_to)} />}
        title={<span title={t.title}>{t.title}</span>}
        subtitle={<span className="inline-flex items-center gap-2"><WeightDots weight={t.weight_snapshot} />Assigned to {name(t.assigned_to)}</span>}
        trailing={<Badge tone={done ? "positive" : due.overdue ? "negative" : "neutral"}>{done ? "Done" : due.text}</Badge>}
      />
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
        {done ? <p className="text-xs text-muted">Done by {name(t.completed_by)} · {t.completed_at && timeAgo(t.completed_at)} · {t.weight_snapshot} pts credited to {name(t.points_credited_to)}</p> : <>
          {t.assigned_to === memberId && <Button className="min-h-11" size="sm" disabled={busy} onClick={() => mutate(() => ops.completeTask(t.id, memberId), "Task completed. Fairness updated.")}><Check size={16} />Mark done</Button>}
          {t.assigned_to === memberId && !bounty && <Button className="min-h-11" size="sm" variant="secondary" disabled={busy}
            aria-label={`Offer ${formatPence(t.weight_snapshot * board!.flat.buyout_rate_pence)} bounty`}
            onClick={() => mutate(async () => (await ops.offerBounty(t.id, memberId)).mutation, "Bounty offered to your flatmates.")}>
            <Coins size={16} />Offer <Amount pence={t.weight_snapshot * board!.flat.buyout_rate_pence} />
          </Button>}
          {bounty?.status === "open" && <Badge tone="warning">Bounty open · <Amount pence={bounty.amount_pence} /></Badge>}
          {bounty?.status === "accepted" && <span className="text-xs text-muted">On completion, points go to {name(bounty.offered_by)}.</span>}
        </>}
      </div>
    </article>;
  }

  return <div className="flex flex-col gap-6" aria-busy={busy}>
    {displayError && <p role="alert" className="text-sm text-negative">{displayError}</p>}
    {notice && <p role="status" className="text-sm text-positive">{notice}</p>}
    <Section title="Chores" action={<Button size="sm" className="min-h-11" variant="ghost" onClick={reload}>Refresh</Button>}>
      <SegmentedControl options={[{ value: "mine", label: "My tasks" }, { value: "all", label: "All tasks" }]} value={view} onChange={setView} />
      <div className="mt-3">{tasks.length ? <List>{tasks.map(taskRow)}</List> : <EmptyState>No tasks here. Enjoy the breathing room.</EmptyState>}</div>
    </Section>
    <Section title="Bounty board">
      <p className="mb-3 text-xs text-muted">Accepting creates a debt immediately. Fairness points go to the offerer when the task is done. No real payment is made.</p>
      {openOffers.length ? <List>{openOffers.map(b => <ListRow key={b.id}
        leading={<Coins size={20} className="text-warning" />}
        title={board.tasks.find(t => t.id === b.task_id)?.title}
        subtitle={<>{name(b.offered_by)} offers <Amount pence={b.amount_pence} /></>}
        trailing={b.offered_by === memberId
          ? <Button className="min-h-11" size="sm" variant="secondary" disabled={busy} onClick={() => mutate(() => ops.cancelBounty(b.id, memberId), "Offer cancelled.")}>Cancel offer</Button>
          : <Button className="min-h-11" size="sm" disabled={busy} aria-label={`Accept for ${formatPence(b.amount_pence)}`} onClick={() => mutate(() => ops.acceptBounty(b.id, memberId), "Task reassigned and debt recorded.")}>Take it</Button>}
      />)}</List> : <EmptyState>No open offers. Offer a bounty on one of your tasks when you need a hand.</EmptyState>}
      {accepted.length > 0 && <div className="mt-3"><List>{accepted.map(b => <ListRow key={b.id}
        title={<span className="whitespace-normal"><Amount pence={b.amount_pence} /> buyout recorded: {name(b.offered_by)} → {name(b.accepted_by)}</span>}
        subtitle={`Buyout: ${board.tasks.find(t => t.id === b.task_id)?.title} · recorded on acceptance`}
        trailing={<Badge tone="positive">Accepted</Badge>}
      />)}</List></div>}
    </Section>
    <Section title="Fairness · last 28 days">
      <Card className="flex flex-col gap-4">{board.members.map(m => <div key={m.id} className="flex items-center gap-3">
        <Avatar name={m.name} size={28} /><div className="flex-1"><div className="mb-1 flex justify-between text-sm">
          <span>{m.id === memberId ? "You" : m.name}</span><span aria-label={`${m.name} fairness score`} className="tabular-nums text-muted">{m.fairness_score} {m.fairness_score === 1 ? "pt" : "pts"}</span>
        </div><ProgressBar value={m.fairness_score} max={maxPoints} /></div>
      </div>)}<p className="text-xs text-muted">New tasks go to the lowest completed score. Open tasks don’t count, so several may go to the same person.</p></Card>
    </Section>
    {board.chores.some(c => c.kind === "recurring" && c.active) && <Section title="Scheduled chores"><List>
      {board.chores.filter(c => c.kind === "recurring" && c.active).map(c => <ListRow key={c.id} leading={<Repeat size={18} />} title={`${c.title} · every ${c.interval_days} days`}
        subtitle={`Next: ${c.next_due_at ? new Date(c.next_due_at).toLocaleString("en-GB") : "Not scheduled"}`} trailing={<WeightDots weight={c.weight} />} />)}
    </List><p className="mt-2 text-xs text-muted">Tasks appear when due. Completing a task doesn’t change its schedule.</p></Section>}
    <Fab label="Add chore" onClick={() => setAdding(true)} />
    {adding && <AddChoreSheet busy={busy} error={error} onClose={() => { if (!busy) setAdding(false); }} onCreate={async input => {
      const saved = await mutate(async () => (await ops.createChore({ ...input, flatId, createdBy: memberId })).mutation, "Chore saved. Due tasks have been assigned.");
      if (saved) setAdding(false);
    }} />}
  </div>;
}

function AddChoreSheet({ busy, error, onClose, onCreate }: {
  busy: boolean; error: string | null; onClose: () => void;
  onCreate: (input: { title: string; weight: number; kind: "one_off" | "recurring"; intervalDays?: number; firstDueAt?: string }) => Promise<void>;
}) {
  const [kind, setKind] = useState<"recurring" | "one_off">("one_off");
  const [weight, setWeight] = useState(2);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const due = String(data.get("due") || "");
    await onCreate({ title: String(data.get("title")).trim(), weight, kind,
      intervalDays: kind === "recurring" ? Number(data.get("interval")) : undefined,
      firstDueAt: due ? new Date(due).toISOString() : undefined });
  }
  return <Sheet open onClose={onClose} title="Add chore">
    <SegmentedControl options={[{ value: "one_off", label: "One-off" }, { value: "recurring", label: "Recurring" }]} value={kind} onChange={value => { if (!busy) setKind(value); }} />
    <form onSubmit={submit}><fieldset disabled={busy} className="flex flex-col gap-4">
      <Input name="title" label="Chore title" placeholder="Clean the bathroom" required maxLength={200} autoFocus />
      {kind === "recurring" && <Input name="interval" label="Every how many days?" type="number" min={1} step={1} defaultValue={7} required />}
      <Input name="due" label={kind === "recurring" ? "First due date" : "Due date (optional)"} type="datetime-local" required={kind === "recurring"} />
      <div><p className="mb-2 text-sm font-medium text-muted">Effort</p><div className="grid grid-cols-5 gap-2" role="group" aria-label="Weight">
        {[1,2,3,4,5].map(w => <Button type="button" key={w} variant={weight === w ? "primary" : "secondary"} aria-pressed={weight === w} aria-label={`${w} points`} onClick={() => setWeight(w)}>{w}</Button>)}
      </div></div>
      <p className="text-xs text-muted">One-off tasks are assigned now. Recurring tasks are created only once their due date arrives.</p>
      {error && <p role="alert" className="text-sm text-negative">{error}</p>}
      <Button type="submit">{busy ? "Saving…" : "Create chore"}</Button>
    </fieldset></form>
  </Sheet>;
}

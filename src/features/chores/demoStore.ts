// Chore state for the demo flat. There's no database behind /flat/demo, so the chore RPCs
// (board, complete, offer, accept, cancel, create) run against this in-memory copy instead.
// The rules mirror supabase/migrations/003_chores.sql. It survives switching tabs; a page
// reload resets the demo to its start state.
import { DEMO_FLAT_ID, demoBounties, demoChores, demoFlat, demoMembers, demoTasks } from "@/lib/mock";
import type { Bounty, Chore, ChoreTask } from "@/lib/types";
import { demoAddExpense } from "@/features/split/demoStore";
import type { ChoreBoard, MutationResult } from "./types";

const DAY = 86_400_000;
const daysAgo = (d: number) => new Date(Date.now() - d * DAY).toISOString();

// A few weeks of finished chores so the fairness bars have something to show.
const history: ChoreTask[] = (
  [
    ["h1", "c1", "m-sam", 20],
    ["h2", "c2", "m-sam", 18],
    ["h3", "c3", "m-priya", 15],
    ["h4", "c2", "m-priya", 11],
    ["h5", "c1", "m-alex", 13],
    ["h6", "c3", "m-alex", 8],
    ["h7", "c3", "m-tom", 9],
    ["h8", "c1", "m-sam", 4],
  ] as const
).map(([id, chore_id, member, ago]) => ({
  id,
  chore_id,
  flat_id: DEMO_FLAT_ID,
  assigned_to: member,
  due_at: daysAgo(ago),
  weight_snapshot: demoChores.find((c) => c.id === chore_id)!.weight,
  status: "done",
  completed_by: member,
  completed_at: daysAgo(ago),
  points_credited_to: member,
  created_at: daysAgo(ago + 1),
}));

interface DemoChoreState {
  chores: Chore[];
  tasks: ChoreTask[];
  bounties: Bounty[];
}

let state: DemoChoreState = { chores: demoChores, tasks: [...demoTasks, ...history], bounties: demoBounties };
const listeners = new Set<() => void>();

function update(patch: Partial<DemoChoreState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const subscribeDemoChores = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getDemoChoreState = () => state;

const id = (prefix: string) => `demo-${prefix}-${crypto.randomUUID()}`;
const now = () => new Date().toISOString();
const result = (taskIds: string[], extra: Partial<MutationResult> = {}): MutationResult => ({ flat_id: DEMO_FLAT_ID, task_ids: taskIds, ...extra });

/** Points credited over the last 28 days (chore_fairness). */
function fairness(): Map<string, number> {
  const since = Date.now() - 28 * DAY;
  const scores = new Map(demoMembers.map((m) => [m.id, 0]));
  for (const t of state.tasks) {
    if (t.status !== "done" || !t.points_credited_to || !t.completed_at) continue;
    const at = new Date(t.completed_at).getTime();
    if (at > since && at <= Date.now()) scores.set(t.points_credited_to, (scores.get(t.points_credited_to) ?? 0) + t.weight_snapshot);
  }
  return scores;
}

/** Lowest score wins; ties go to whoever did this chore least recently (choose_chore_assignee). */
function chooseAssignee(choreId: string): string {
  const scores = fairness();
  const lastDone = (memberId: string) =>
    Math.max(0, ...state.tasks.filter((t) => t.chore_id === choreId && t.completed_by === memberId && t.completed_at).map((t) => new Date(t.completed_at!).getTime()));
  return [...demoMembers].sort((a, b) => scores.get(a.id)! - scores.get(b.id)! || lastDone(a.id) - lastDone(b.id))[0].id;
}

function findTask(taskId: string): ChoreTask {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) throw new Error("Task not found");
  return task;
}

const liveBounty = (taskId: string) => state.bounties.find((b) => b.task_id === taskId && (b.status === "open" || b.status === "accepted"));
const replaceTask = (task: ChoreTask) => state.tasks.map((t) => (t.id === task.id ? task : t));
const replaceBounty = (bounty: Bounty) => state.bounties.map((b) => (b.id === bounty.id ? bounty : b));

// ─── Reads ───────────────────────────────────────────────────────────────────

export function demoChoreBoard(): ChoreBoard {
  const scores = fairness();
  const title = (choreId: string) => state.chores.find((c) => c.id === choreId)?.title ?? "Chore";
  return {
    flat: { id: DEMO_FLAT_ID, name: demoFlat.name, buyout_rate_pence: demoFlat.buyout_rate_pence },
    members: demoMembers.map((m) => ({ id: m.id, name: m.name, fairness_score: scores.get(m.id) ?? 0 })),
    chores: [...state.chores].sort((a, b) => a.title.localeCompare(b.title)),
    // Open first, then by due date (no due date last), like get_chore_board.
    tasks: [...state.tasks]
      .sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999") || a.id.localeCompare(b.id))
      .map((t) => ({ ...t, title: title(t.chore_id) })),
    bounties: state.bounties.filter((b) => b.status === "open" || b.status === "accepted").sort((a, b) => b.created_at.localeCompare(a.created_at)),
  };
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function demoCompleteTask(taskId: string, memberId: string): MutationResult {
  const task = findTask(taskId);
  if (task.assigned_to !== memberId) throw new Error("Only the current assignee can complete this task");
  const bounty = liveBounty(taskId);
  if (task.status === "open") {
    update({
      // An open offer is withdrawn; an accepted one credits the points to the offerer.
      bounties: bounty?.status === "open" ? replaceBounty({ ...bounty, status: "cancelled" }) : state.bounties,
      tasks: replaceTask({
        ...task,
        status: "done",
        completed_by: memberId,
        completed_at: now(),
        points_credited_to: bounty?.status === "accepted" ? bounty.offered_by : memberId,
      }),
    });
  }
  return result([taskId], { bounty_id: bounty?.id ?? null });
}

export function demoOfferBounty(taskId: string, memberId: string): MutationResult {
  const task = findTask(taskId);
  if (task.status !== "open") throw new Error("Task is not open");
  if (task.assigned_to !== memberId) throw new Error("Only the current assignee can offer a bounty");
  const existing = liveBounty(taskId);
  if (existing?.status === "accepted") throw new Error("Task has already been bought out");
  if (existing) return result([taskId], { bounty_id: existing.id });

  const bounty: Bounty = {
    id: id("bounty"),
    flat_id: DEMO_FLAT_ID,
    task_id: taskId,
    offered_by: memberId,
    amount_pence: task.weight_snapshot * demoFlat.buyout_rate_pence,
    status: "open",
    accepted_by: null,
    created_at: now(),
  };
  update({ bounties: [bounty, ...state.bounties] });
  return result([taskId], { bounty_id: bounty.id });
}

export function demoCancelBounty(bountyId: string, memberId: string): MutationResult {
  const bounty = state.bounties.find((b) => b.id === bountyId);
  if (!bounty) throw new Error("Bounty not found");
  if (bounty.offered_by !== memberId) throw new Error("Only the offerer can cancel");
  if (bounty.status === "accepted") throw new Error("An accepted bounty cannot be cancelled");
  if (bounty.status === "open") update({ bounties: replaceBounty({ ...bounty, status: "cancelled" }) });
  return result([bounty.task_id], { bounty_id: bountyId });
}

/** Reassigns the task and records the buyout as a Split expense: the offerer owes the taker. */
export function demoAcceptBounty(bountyId: string, memberId: string): MutationResult {
  const bounty = state.bounties.find((b) => b.id === bountyId);
  if (!bounty) throw new Error("Bounty not found");
  if (bounty.offered_by === memberId) throw new Error("You cannot accept your own offer");
  const task = findTask(bounty.task_id);
  if (bounty.status !== "open" || task.status !== "open") throw new Error("Bounty and task must be open");
  if (task.assigned_to !== bounty.offered_by) throw new Error("Offerer is no longer the assignee");

  const chore = state.chores.find((c) => c.id === task.chore_id);
  demoAddExpense({
    flatId: DEMO_FLAT_ID,
    payerId: memberId,
    createdBy: memberId,
    description: `Buyout: ${chore?.title ?? "chore"}`,
    amountPence: bounty.amount_pence,
    splitType: "amount",
    shares: { [bounty.offered_by]: bounty.amount_pence },
    bountyId,
  });
  update({
    tasks: replaceTask({ ...task, assigned_to: memberId }),
    bounties: replaceBounty({ ...bounty, status: "accepted", accepted_by: memberId }),
  });
  return result([task.id], { bounty_id: bountyId });
}

export function demoCreateChore(input: {
  createdBy: string;
  title: string;
  weight: number;
  kind: Chore["kind"];
  intervalDays?: number;
  firstDueAt?: string;
}): MutationResult {
  const title = input.title.trim();
  if (!title || title.length > 200 || !Number.isInteger(input.weight) || input.weight < 1 || input.weight > 5) {
    throw new Error("A title and integer weight from 1 to 5 are required");
  }
  const recurring = input.kind === "recurring";
  if (recurring && (!input.intervalDays || input.intervalDays < 1 || !input.firstDueAt)) {
    throw new Error("Recurring chores need a positive interval and first due date");
  }

  const chore: Chore = {
    id: id("chore"),
    flat_id: DEMO_FLAT_ID,
    title,
    weight: input.weight,
    created_by: input.createdBy,
    kind: input.kind,
    interval_days: recurring ? input.intervalDays! : null,
    next_due_at: recurring ? input.firstDueAt! : null,
    weight_proposed_at: now(),
    active: true,
    created_at: now(),
  };
  state = { ...state, chores: [...state.chores, chore] }; // visible to chooseAssignee below

  const newTask = (dueAt: string | null): ChoreTask => ({
    id: id("task"),
    chore_id: chore.id,
    flat_id: DEMO_FLAT_ID,
    assigned_to: chooseAssignee(chore.id),
    due_at: dueAt,
    weight_snapshot: chore.weight,
    status: "open",
    completed_by: null,
    completed_at: null,
    points_credited_to: null,
    created_at: now(),
  });

  // One-off: assigned now. Recurring: one task per occurrence that's already due (generate_chore_tasks).
  const tasks: ChoreTask[] = [];
  if (!recurring) tasks.push(newTask(input.firstDueAt ?? null));
  else {
    let next = new Date(chore.next_due_at!).getTime();
    while (next <= Date.now()) {
      tasks.push(newTask(new Date(next).toISOString()));
      next += chore.interval_days! * DAY;
    }
    chore.next_due_at = new Date(next).toISOString();
  }
  update({ tasks: [...state.tasks, ...tasks] });
  return result(
    tasks.map((t) => t.id),
    { chore_id: chore.id },
  );
}

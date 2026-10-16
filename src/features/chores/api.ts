// Part 3 owns this API. Keep the Home and FlatProvider CONTRACT signatures stable.
import { supabase } from "@/lib/supabase";
import { getMemberId } from "@/lib/identity";
import type { Bounty, Chore, ChoreTask } from "@/lib/types";
import type { ChoreBoard, MutationResult } from "./types";

function memberId(flatId: string): string {
  const id = getMemberId(flatId);
  if (!id) throw new Error("Join this flat before changing chores.");
  return id;
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export function getChoreBoard(flatId: string, currentMemberId = memberId(flatId)): Promise<ChoreBoard> {
  return rpc("get_chore_board", { p_flat_id: flatId, p_member_id: currentMemberId });
}

/** Rolling completed task snapshots, credited to the contributor over the last 28 days. */
export async function getFairness(flatId: string): Promise<{ member_id: string; points: number }[]> {
  const board = await getChoreBoard(flatId);
  return board.members.map(m => ({ member_id: m.id, points: m.fairness_score }));
}

/** Preview only. Creation chooses and assigns again inside its database transaction. */
export function pickAssignee(flatId: string, choreId: string): Promise<string> {
  return rpc("get_chore_assignee", { p_flat_id: flatId, p_member_id: memberId(flatId), p_chore_id: choreId });
}

export async function createChore(input: {
  flatId: string;
  createdBy: string;
  title: string;
  weight: number;
  kind: Chore["kind"];
  intervalDays?: number;
  firstDueAt?: string;
}): Promise<Chore & { mutation: MutationResult }> {
  const result = await rpc<MutationResult & { chore: Chore }>("create_chore", {
    p_flat_id: input.flatId, p_member_id: input.createdBy, p_title: input.title,
    p_weight: input.weight, p_kind: input.kind, p_interval_days: input.intervalDays ?? null,
    p_due_at: input.firstDueAt ?? null,
  });
  return { ...result.chore, mutation: result };
}

export function completeTask(taskId: string, currentMemberId: string): Promise<MutationResult> {
  return rpc("complete_chore_task", { p_task_id: taskId, p_member_id: currentMemberId });
}

/** CONTRACT (Home): open tasks, optionally restricted to the current assignee. */
export async function getOpenTasks(flatId: string, assignedTo?: string): Promise<(ChoreTask & { chore: Chore })[]> {
  const board = await getChoreBoard(flatId);
  return board.tasks.filter(t => t.status === "open" && (!assignedTo || t.assigned_to === assignedTo))
    .map(t => ({ ...t, chore: board.chores.find(c => c.id === t.chore_id)! }));
}

/** CONTRACT (Home): open offers with their task and chore. */
export async function getOpenBounties(flatId: string): Promise<(Bounty & { task: ChoreTask; chore: Chore })[]> {
  const board = await getChoreBoard(flatId);
  return board.bounties.filter(b => b.status === "open").map(b => {
    const task = board.tasks.find(t => t.id === b.task_id)!;
    return { ...b, task, chore: board.chores.find(c => c.id === task.chore_id)! };
  });
}

/** Price comes only from the database's weight/rate snapshot; raising is deferred. */
export async function offerBounty(taskId: string, offeredBy: string, amountPence?: number): Promise<Bounty & { mutation: MutationResult }> {
  if (amountPence !== undefined) throw new Error("Bounty prices are fixed by the flat rate.");
  const result = await rpc<MutationResult & { bounty: Bounty }>("offer_bounty", { p_task_id: taskId, p_member_id: offeredBy });
  return { ...result.bounty, mutation: result };
}

/** Acceptance, reassignment, expense and share commit together. Do NOT call addExpense again. */
export function acceptBounty(bountyId: string, currentMemberId: string): Promise<MutationResult> {
  return rpc("accept_bounty", { p_bounty_id: bountyId, p_member_id: currentMemberId });
}

export function cancelBounty(bountyId: string, currentMemberId: string): Promise<MutationResult> {
  return rpc("cancel_bounty", { p_bounty_id: bountyId, p_member_id: currentMemberId });
}

/** CONTRACT (FlatProvider): only scheduled occurrences due now, safe to repeat. */
export async function catchUpChores(flatId: string): Promise<void> {
  await rpc("catch_up_chores", { p_flat_id: flatId, p_member_id: memberId(flatId) });
}

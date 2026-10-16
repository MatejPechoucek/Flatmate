// Chores feature — data access, fairness, auto-assign and buyouts.
// Owns tables: chores, chore_tasks, weight_objections, weight_votes, bounties.
//
// Functions marked CONTRACT are used by other parts — keep their signatures stable.
import type { Bounty, Chore, ChoreTask } from "@/lib/types";

/** Rolling 28-day fairness points per member (completed tasks credited to them). */
export async function getFairness(flatId: string): Promise<{ member_id: string; points: number }[]> {
  void flatId;
  throw new Error("TODO(chores): getFairness");
}

/** Lowest fairness score wins; ties → whoever did this chore least recently, then random. */
export async function pickAssignee(flatId: string, choreId: string): Promise<string> {
  void flatId;
  void choreId;
  throw new Error("TODO(chores): pickAssignee");
}

/** Create a chore and its first task (auto-assigned). */
export async function createChore(input: {
  flatId: string;
  createdBy: string;
  title: string;
  weight: number;
  kind: Chore["kind"];
  intervalDays?: number;
  firstDueAt?: string;
}): Promise<Chore> {
  void input;
  throw new Error("TODO(chores): createChore");
}

/** Mark done; points go to the bounty offerer if the task was bought out, else to the doer. */
export async function completeTask(taskId: string, memberId: string): Promise<void> {
  void taskId;
  void memberId;
  throw new Error("TODO(chores): completeTask");
}

/** CONTRACT (used by Home). Open tasks, optionally only those assigned to one member. */
export async function getOpenTasks(flatId: string, assignedTo?: string): Promise<(ChoreTask & { chore: Chore })[]> {
  void flatId;
  void assignedTo;
  throw new Error("TODO(chores): getOpenTasks");
}

/** CONTRACT (used by Home). Open bounties with their task + chore. */
export async function getOpenBounties(flatId: string): Promise<(Bounty & { task: ChoreTask; chore: Chore })[]> {
  void flatId;
  throw new Error("TODO(chores): getOpenBounties");
}

/** Price = chore.weight × flat.buyout_rate_pence (or higher if raised). */
export async function offerBounty(taskId: string, offeredBy: string, amountPence?: number): Promise<Bounty> {
  void taskId;
  void offeredBy;
  void amountPence;
  throw new Error("TODO(chores): offerBounty");
}

/**
 * First to accept wins (update ... where status = 'open'). Reassigns the task to the accepter
 * and calls split's addExpense({ payerId: accepter, shares: { [offerer]: amount }, bountyId }).
 */
export async function acceptBounty(bountyId: string, memberId: string): Promise<void> {
  void bountyId;
  void memberId;
  throw new Error("TODO(chores): acceptBounty");
}

export async function objectToWeight(choreId: string, memberId: string, proposedWeight: number): Promise<void> {
  void choreId;
  void memberId;
  void proposedWeight;
  throw new Error("TODO(chores): objectToWeight");
}

/**
 * CONTRACT (called by FlatProvider on open). Create a task for every recurring chore whose
 * next_due_at <= now, auto-assign it, then advance next_due_at. UNIQUE (chore_id, due_at)
 * makes concurrent calls safe.
 */
export async function catchUpChores(flatId: string): Promise<void> {
  void flatId; // TODO(chores)
}

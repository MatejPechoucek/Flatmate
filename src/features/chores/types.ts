import type { Bounty, Chore, ChoreTask } from "@/lib/types";

// Board task rows carry their chore title alongside the shared task columns.
export type Task = ChoreTask & { title: string };
export interface MutationResult {
  flat_id: string;
  task_ids: string[];
  chore_id?: string;
  bounty_id?: string | null;
  expense_id?: string;
}
export interface ChoreBoard {
  flat: { id: string; name: string; buyout_rate_pence: number };
  members: { id: string; name: string; fairness_score: number }[];
  chores: Chore[];
  tasks: Task[];
  bounties: Bounty[];
}

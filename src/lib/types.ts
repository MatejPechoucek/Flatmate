// Row types mirroring supabase/schema.sql. Keep in sync when the schema changes.
// Money is always integer pence; timestamps are ISO strings.

export type SplitType = "equal" | "amount" | "percent";

export interface Flat {
  id: string;
  name: string;
  invite_code: string;
  buyout_rate_pence: number;
  created_at: string;
}

export interface Member {
  id: string;
  flat_id: string;
  name: string;
  pay_handle: string | null;
  created_at: string;
}

// ─── Split ───

export interface Expense {
  id: string;
  flat_id: string;
  payer_id: string;
  description: string;
  amount_pence: number;
  split_type: SplitType;
  recurring_expense_id: string | null;
  bounty_id: string | null;
  due_at: string | null;
  created_at: string;
}

export interface ExpenseShare {
  expense_id: string;
  member_id: string;
  amount_pence: number;
}

export interface RecurringExpense {
  id: string;
  flat_id: string;
  payer_id: string;
  description: string;
  amount_pence: number;
  split_type: SplitType;
  split_config: Record<string, number>;
  interval: "weekly" | "monthly";
  next_due_at: string;
  active: boolean;
  created_at: string;
}

export interface Settlement {
  id: string;
  flat_id: string;
  from_member: string;
  to_member: string;
  amount_pence: number;
  created_at: string;
}

// ─── Chores ───

export interface Chore {
  id: string;
  flat_id: string;
  title: string;
  weight: number; // 1–5
  created_by: string | null;
  kind: "recurring" | "one_off";
  interval_days: number | null;
  next_due_at: string | null;
  weight_proposed_at: string;
  active: boolean;
  created_at: string;
}

export interface WeightObjection {
  id: string;
  chore_id: string;
  member_id: string;
  proposed_weight: number;
  resolved: boolean;
  created_at: string;
}

export interface WeightVote {
  objection_id: string;
  member_id: string;
  weight: number;
}

export interface ChoreTask {
  id: string;
  chore_id: string;
  flat_id: string;
  assigned_to: string | null;
  due_at: string | null;
  status: "open" | "done";
  completed_by: string | null;
  completed_at: string | null;
  points_credited_to: string | null;
  created_at: string;
}

export interface Bounty {
  id: string;
  flat_id: string;
  task_id: string;
  offered_by: string;
  amount_pence: number;
  status: "open" | "accepted" | "cancelled";
  accepted_by: string | null;
  created_at: string;
}

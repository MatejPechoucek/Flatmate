// Sample data for the /flat/demo skeleton. Lets you design screens without a database.
// Replace usages with real Supabase queries as features get built.
import type { Bounty, Chore, ChoreTask, Expense, Flat, Member } from "./types";

const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();
const inDays = (d: number) => new Date(now + d * 86_400_000).toISOString();

export const DEMO_FLAT_ID = "demo";

export const demoFlat: Flat = {
  id: DEMO_FLAT_ID,
  name: "14 Gower Street",
  invite_code: "K7PX2Q",
  buyout_rate_pence: 100,
  created_at: daysAgo(40),
};

const member = (id: string, name: string, pay_handle: string | null = null): Member => ({
  id,
  flat_id: DEMO_FLAT_ID,
  name,
  pay_handle,
  created_at: daysAgo(40),
});

export const demoMembers: Member[] = [
  member("m-alex", "Alex", "alexmonzo"),
  member("m-sam", "Sam", "samj"),
  member("m-priya", "Priya", "paypal:priyak"),
  member("m-tom", "Tom"),
];

export const DEMO_ME_ID = "m-alex";

export const demoExpenses: (Expense & { your_share_pence: number })[] = [
  { id: "e1", flat_id: DEMO_FLAT_ID, payer_id: "m-alex", description: "Tesco big shop", amount_pence: 4260, split_type: "equal", recurring_expense_id: null, bounty_id: null, due_at: null, created_by: "m-alex", edited_at: null, deleted_at: null, created_at: daysAgo(0), your_share_pence: 1065 },
  { id: "e2", flat_id: DEMO_FLAT_ID, payer_id: "m-sam", description: "Wi-Fi · October", amount_pence: 3200, split_type: "equal", recurring_expense_id: "r1", bounty_id: null, due_at: daysAgo(2), created_by: "m-sam", edited_at: null, deleted_at: null, created_at: daysAgo(2), your_share_pence: 800 },
  { id: "e3", flat_id: DEMO_FLAT_ID, payer_id: "m-priya", description: "Cleaning supplies", amount_pence: 1150, split_type: "percent", recurring_expense_id: null, bounty_id: null, due_at: null, created_by: "m-priya", edited_at: daysAgo(4), deleted_at: null, created_at: daysAgo(5), your_share_pence: 345 },
  { id: "e4", flat_id: DEMO_FLAT_ID, payer_id: "m-tom", description: "Buyout: Bathroom deep clean", amount_pence: 500, split_type: "amount", recurring_expense_id: null, bounty_id: "b0", due_at: null, created_by: "m-tom", edited_at: null, deleted_at: null, created_at: daysAgo(6), your_share_pence: 500 },
];

/** Net balance per member, from the viewer's (Alex's) perspective: + means they owe you. */
export const demoBalances: { member_id: string; pence: number }[] = [
  { member_id: "m-sam", pence: 265 },
  { member_id: "m-priya", pence: -345 },
  { member_id: "m-tom", pence: 1065 },
];

export const demoChores: Chore[] = [
  { id: "c1", flat_id: DEMO_FLAT_ID, title: "Take the bins out", weight: 1, created_by: "m-alex", kind: "recurring", interval_days: 7, next_due_at: inDays(1), weight_proposed_at: daysAgo(30), active: true, created_at: daysAgo(30) },
  { id: "c2", flat_id: DEMO_FLAT_ID, title: "Bathroom deep clean", weight: 5, created_by: "m-sam", kind: "recurring", interval_days: 14, next_due_at: inDays(3), weight_proposed_at: daysAgo(30), active: true, created_at: daysAgo(30) },
  { id: "c3", flat_id: DEMO_FLAT_ID, title: "Hoover the lounge", weight: 2, created_by: "m-priya", kind: "recurring", interval_days: 7, next_due_at: inDays(2), weight_proposed_at: daysAgo(20), active: true, created_at: daysAgo(20) },
  { id: "c4", flat_id: DEMO_FLAT_ID, title: "Buy toilet roll", weight: 1, created_by: "m-tom", kind: "one_off", interval_days: null, next_due_at: inDays(0), weight_proposed_at: daysAgo(1), active: true, created_at: daysAgo(1) },
];

const task = (id: string, chore_id: string, assigned_to: string, due: number, done = false): ChoreTask => ({
  id,
  chore_id,
  flat_id: DEMO_FLAT_ID,
  assigned_to,
  due_at: due >= 0 ? inDays(due) : daysAgo(-due),
  weight_snapshot: demoChores.find((c) => c.id === chore_id)!.weight,
  status: done ? "done" : "open",
  completed_by: done ? assigned_to : null,
  completed_at: done ? daysAgo(-due) : null,
  points_credited_to: done ? assigned_to : null,
  created_at: daysAgo(7),
});

export const demoTasks: ChoreTask[] = [
  task("t1", "c1", "m-alex", 1),
  task("t2", "c2", "m-alex", 3),
  task("t3", "c3", "m-priya", 2),
  task("t4", "c4", "m-sam", -1),
  task("t5", "c1", "m-tom", -6, true),
];

/** Rolling 28-day fairness points. */
export const demoFairness: { member_id: string; points: number }[] = [
  { member_id: "m-alex", points: 6 },
  { member_id: "m-sam", points: 9 },
  { member_id: "m-priya", points: 7 },
  { member_id: "m-tom", points: 4 },
];

export const demoBounties: Bounty[] = [
  { id: "b1", flat_id: DEMO_FLAT_ID, task_id: "t3", offered_by: "m-priya", amount_pence: 300, status: "open", accepted_by: null, created_at: daysAgo(0) },
];

export const demoActivity: { id: string; member_id: string; text: string; at: string }[] = [
  { id: "a1", member_id: "m-alex", text: "added Tesco big shop · £42.60", at: daysAgo(0) },
  { id: "a2", member_id: "m-priya", text: "offered a £3 bounty for Hoover the lounge", at: daysAgo(0) },
  { id: "a3", member_id: "m-tom", text: "took the bins out", at: daysAgo(6) },
  { id: "a4", member_id: "m-tom", text: "bought out Bathroom deep clean from Sam", at: daysAgo(6) },
];

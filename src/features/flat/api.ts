// Flat feature — onboarding, identity, home summary.
// Owns tables: flats, members.
import { supabase } from "@/lib/supabase";
import { generateInviteCode, setMemberId } from "@/lib/identity";
import type { Chore, ChoreTask, Expense, Flat, Member } from "@/lib/types";

const clean = (s?: string) => s?.trim() || null;

/** "@alex", "monzo.me/alex", "https://paypal.me/priya" → "alex" / "paypal:priya". */
function normaliseHandle(raw?: string): string | null {
  const h = clean(raw);
  if (!h) return null;
  const paypal = h.match(/paypal\.me\/([^/?\s]+)/i);
  if (paypal) return `paypal:${paypal[1]}`;
  if (/^paypal:/i.test(h)) return `paypal:${h.slice(7)}`;
  return h.replace(/^https?:\/\//, "").replace(/^monzo\.me\//i, "").replace(/^@/, "").split(/[/?]/)[0];
}

/** Create a flat + its first member, remember them on this device (setMemberId). */
export async function createFlat(input: { flatName: string; memberName: string; payHandle?: string }): Promise<{
  flat: Flat;
  member: Member;
}> {
  const name = clean(input.flatName);
  if (!name) throw new Error("Give your flat a name");
  if (!clean(input.memberName)) throw new Error("Tell your flatmates your name");

  // Retry on the (unlikely) invite-code collision: 23505 = unique violation.
  let flat: Flat | null = null;
  for (let attempt = 0; attempt < 5 && !flat; attempt++) {
    const { data, error } = await supabase
      .from("flats")
      .insert({ name, invite_code: generateInviteCode() })
      .select()
      .single<Flat>();
    if (error && error.code !== "23505") throw error;
    flat = data;
  }
  if (!flat) throw new Error("Couldn't create the flat, try again");

  const member = await joinFlat(flat.id, { name: input.memberName, payHandle: input.payHandle });
  return { flat, member };
}

/** Look up a flat by invite code (case-insensitive). Null if not found. */
export async function findFlatByCode(code: string): Promise<{ flat: Flat; members: Member[] } | null> {
  const normalised = code.trim().toUpperCase();
  if (!normalised) return null;
  const { data: flat, error } = await supabase.from("flats").select("*").eq("invite_code", normalised).maybeSingle<Flat>();
  if (error) throw error;
  if (!flat) return null;
  const { data: members, error: mErr } = await supabase
    .from("members")
    .select("*")
    .eq("flat_id", flat.id)
    .order("created_at")
    .returns<Member[]>();
  if (mErr) throw mErr;
  return { flat, members: members ?? [] };
}

/** Add a member to a flat and remember them on this device (setMemberId). */
export async function joinFlat(flatId: string, input: { name: string; payHandle?: string }): Promise<Member> {
  const name = clean(input.name);
  if (!name) throw new Error("Tell your flatmates your name");
  const { data, error } = await supabase
    .from("members")
    .insert({ flat_id: flatId, name, pay_handle: normaliseHandle(input.payHandle) })
    .select()
    .single<Member>();
  if (error) throw error;
  setMemberId(flatId, data.id);
  return data;
}

export async function updateBuyoutRate(flatId: string, pence: number): Promise<void> {
  if (!Number.isInteger(pence) || pence <= 0) throw new Error("Rate must be more than £0");
  const { error } = await supabase.from("flats").update({ buyout_rate_pence: pence }).eq("id", flatId);
  if (error) throw error;
}

// ─── Activity feed ───────────────────────────────────────────────────────────

export type ActivityItem =
  | { id: string; kind: "expense"; member_id: string; at: string; expense: Expense }
  | { id: string; kind: "chore"; member_id: string; at: string; title: string };

/** Latest expenses + completed chores, merged newest first. */
export async function getActivity(flatId: string, limit = 15): Promise<ActivityItem[]> {
  const [expRes, taskRes] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .eq("flat_id", flatId)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<Expense[]>(),
    supabase
      .from("chore_tasks")
      .select("*, chore:chores(title)")
      .eq("flat_id", flatId)
      .eq("status", "done")
      .order("completed_at", { ascending: false })
      .limit(limit)
      .returns<(ChoreTask & { chore: Pick<Chore, "title"> | null })[]>(),
  ]);
  if (expRes.error) throw expRes.error;
  if (taskRes.error) throw taskRes.error;

  const items: ActivityItem[] = [
    ...(expRes.data ?? []).map((e) => ({ id: `e:${e.id}`, kind: "expense" as const, member_id: e.payer_id, at: e.created_at, expense: e })),
    ...(taskRes.data ?? []).map((t) => ({
      id: `t:${t.id}`,
      kind: "chore" as const,
      member_id: t.completed_by ?? t.assigned_to ?? "",
      at: t.completed_at ?? t.created_at,
      title: t.chore?.title ?? "a chore",
    })),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

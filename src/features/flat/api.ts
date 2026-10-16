// Flat feature — onboarding, identity, home summary.
// Owns tables: flats, members.
import type { Flat, Member } from "@/lib/types";

/** Create a flat + its first member, remember them on this device (setMemberId). */
export async function createFlat(input: { flatName: string; memberName: string; payHandle?: string }): Promise<{
  flat: Flat;
  member: Member;
}> {
  void input;
  throw new Error("TODO(flat): createFlat"); // insert flats (generateInviteCode) + members
}

/** Look up a flat by invite code (case-insensitive). Null if not found. */
export async function findFlatByCode(code: string): Promise<{ flat: Flat; members: Member[] } | null> {
  void code;
  throw new Error("TODO(flat): findFlatByCode");
}

/** Add a member to a flat and remember them on this device (setMemberId). */
export async function joinFlat(flatId: string, input: { name: string; payHandle?: string }): Promise<Member> {
  void flatId;
  void input;
  throw new Error("TODO(flat): joinFlat");
}

export async function updateBuyoutRate(flatId: string, pence: number): Promise<void> {
  void flatId;
  void pence;
  throw new Error("TODO(flat): updateBuyoutRate");
}

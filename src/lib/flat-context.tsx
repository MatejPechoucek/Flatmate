"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabase";
import { getMemberId } from "./identity";
import { useRealtime } from "./useRealtime";
import { catchUpRecurringExpenses } from "@/features/split/api";
import { catchUpChores } from "@/features/chores/api";
import type { Flat, Member } from "./types";

interface FlatContextValue {
  flat: Flat;
  members: Member[];
  me: Member;
  /** Display name: "You" for the current member. */
  memberName: (id: string | null | undefined) => string;
  /** Real name, e.g. for avatars. */
  realName: (id: string | null | undefined) => string;
  reload: () => Promise<void>;
}

const FlatContext = createContext<FlatContextValue | null>(null);

/** The current flat, its members and "me". Only usable inside /flat/[flatId]. */
export function useFlat(): FlatContextValue {
  const ctx = useContext(FlatContext);
  if (!ctx) throw new Error("useFlat must be used inside <FlatProvider>");
  return ctx;
}

export function FlatProvider({ flatId, children }: { flatId: string; children: ReactNode }) {
  const router = useRouter();
  const [flat, setFlat] = useState<Flat | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [flatRes, membersRes] = await Promise.all([
      supabase.from("flats").select("*").eq("id", flatId).single<Flat>(),
      supabase.from("members").select("*").eq("flat_id", flatId).order("created_at").returns<Member[]>(),
    ]);
    if (flatRes.error) return setError("Flat not found");
    setFlat(flatRes.data);
    setMembers(membersRes.data ?? []);

    const id = getMemberId(flatId);
    if (!id || !membersRes.data?.some((m) => m.id === id)) {
      router.replace(`/join/${flatRes.data.invite_code}`);
      return;
    }
    setMeId(id);
  }, [flatId, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch from Supabase
    reload();
    // Generate any recurring expenses / chore tasks that came due since the last visit.
    Promise.all([catchUpRecurringExpenses(flatId), catchUpChores(flatId)]).catch(console.error);
  }, [reload, flatId]);

  useRealtime(flatId, ["flats", "members"], reload);

  if (error) return <p className="p-6 text-center text-muted">{error}</p>;
  const me = members.find((m) => m.id === meId);
  if (!flat || !me) return <p className="p-6 text-center text-muted">Loading…</p>;

  const realName = (id: string | null | undefined) => members.find((m) => m.id === id)?.name ?? "Someone";
  const memberName = (id: string | null | undefined) => (id === me.id ? "You" : realName(id));

  return <FlatContext.Provider value={{ flat, members, me, memberName, realName, reload }}>{children}</FlatContext.Provider>;
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useFlat } from "@/lib/flat-context";
import { useRealtime } from "@/lib/useRealtime";
import type { ExpenseChange } from "@/lib/types";
import { dismissNotice, getMyNotices } from "./api";

/** Edits/deletes by others that affect me and that I haven't dismissed. Live. */
export function useNotices() {
  const { flat, me } = useFlat();
  const [notices, setNotices] = useState<ExpenseChange[]>([]);

  const reload = useCallback(async () => {
    try {
      setNotices(await getMyNotices(flat.id, me.id));
    } catch (e) {
      console.error(e); // notices are best-effort; never block the screen
    }
  }, [flat.id, me.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch from Supabase
    reload();
  }, [reload]);

  useRealtime(flat.id, ["expense_changes"], reload);

  const dismiss = useCallback(
    async (id: string) => {
      setNotices((prev) => prev.filter((n) => n.id !== id)); // optimistic
      await dismissNotice(id, me.id).catch(console.error);
    },
    [me.id],
  );

  return { notices, dismiss };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useFlat } from "@/lib/flat-context";
import { DEMO_FLAT_ID } from "@/lib/mock";
import { useRealtime } from "@/lib/useRealtime";
import type { ExpenseChange } from "@/lib/types";
import { dismissNotice, getMyNotices } from "./api";
import { isNoticeFor } from "./changes";
import { demoChanges } from "./demo";

/** Edits/deletes by others that affect me and that I haven't dismissed. Live. */
export function useNotices() {
  const { flat, me } = useFlat();
  const isDemo = flat.id === DEMO_FLAT_ID;
  const [notices, setNotices] = useState<ExpenseChange[]>(isDemo ? demoChanges.filter((c) => isNoticeFor(c, me.id)) : []);

  const reload = useCallback(async () => {
    if (isDemo) return;
    try {
      setNotices(await getMyNotices(flat.id, me.id));
    } catch (e) {
      console.error(e); // notices are best-effort; never block the screen
    }
  }, [flat.id, me.id, isDemo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch from Supabase
    reload();
  }, [reload]);

  useRealtime(flat.id, isDemo ? [] : ["expense_changes"], reload);

  const dismiss = useCallback(
    async (id: string) => {
      setNotices((prev) => prev.filter((n) => n.id !== id)); // optimistic
      if (!isDemo) await dismissNotice(id, me.id).catch(console.error);
    },
    [isDemo, me.id],
  );

  return { notices, dismiss };
}

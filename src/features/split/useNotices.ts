"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useFlat } from "@/lib/flat-context";
import { DEMO_FLAT_ID } from "@/lib/mock";
import { useRealtime } from "@/lib/useRealtime";
import type { ExpenseChange } from "@/lib/types";
import { dismissNotice, getMyNotices } from "./api";
import { isNoticeFor } from "./changes";
import { demoDismissNotice, getDemoChanges, getDemoDismissed, subscribeDemo } from "./demoStore";

const empty: never[] = [];
const noChanges = () => empty as ExpenseChange[];
const noDismissed = () => empty as string[];

/** Edits/deletes by others that affect me and that I haven't dismissed. Live. */
export function useNotices() {
  const { flat, me } = useFlat();
  const isDemo = flat.id === DEMO_FLAT_ID;
  const [notices, setNotices] = useState<ExpenseChange[]>([]);
  // Demo flat: notices come from the in-memory change log, newest first, minus dismissed ones.
  const demoChanges = useSyncExternalStore(subscribeDemo, getDemoChanges, noChanges); // browser only
  const demoDismissed = useSyncExternalStore(subscribeDemo, getDemoDismissed, noDismissed);
  const demoNotices = useMemo(
    () => demoChanges.filter((c) => isNoticeFor(c, me.id) && !demoDismissed.includes(c.id)).reverse(),
    [demoChanges, demoDismissed, me.id],
  );

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
      if (isDemo) return demoDismissNotice(id);
      setNotices((prev) => prev.filter((n) => n.id !== id)); // optimistic
      await dismissNotice(id, me.id).catch(console.error);
    },
    [isDemo, me.id],
  );

  return { notices: isDemo ? demoNotices : notices, dismiss };
}

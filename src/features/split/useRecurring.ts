"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useFlat } from "@/lib/flat-context";
import { DEMO_FLAT_ID } from "@/lib/mock";
import { useRealtime } from "@/lib/useRealtime";
import type { RecurringExpense } from "@/lib/types";
import { getRecurringExpenses } from "./api";
import { getDemoRules, subscribeDemo } from "./demoStore";

/** Live list of the flat's recurring bill rules. */
export function useRecurring() {
  const { flat } = useFlat();
  const isDemo = flat.id === DEMO_FLAT_ID;
  const [rules, setRules] = useState<RecurringExpense[] | null>(null);
  const demoRules = useSyncExternalStore(subscribeDemo, getDemoRules, getDemoRules); // demo flat: in-memory
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (isDemo) return;
    try {
      setRules(await getRecurringExpenses(flat.id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load recurring bills.");
    }
  }, [flat.id, isDemo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch from Supabase
    reload();
  }, [reload]);

  useRealtime(flat.id, isDemo ? [] : ["recurring_expenses"], reload);

  return { rules: isDemo ? demoRules : rules, error, reload };
}

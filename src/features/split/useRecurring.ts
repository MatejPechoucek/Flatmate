"use client";

import { useCallback, useEffect, useState } from "react";
import { useFlat } from "@/lib/flat-context";
import { useRealtime } from "@/lib/useRealtime";
import type { RecurringExpense } from "@/lib/types";
import { getRecurringExpenses } from "./api";

/** Live list of the flat's recurring bill rules. */
export function useRecurring() {
  const { flat } = useFlat();
  const [rules, setRules] = useState<RecurringExpense[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setRules(await getRecurringExpenses(flat.id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load recurring bills.");
    }
  }, [flat.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch from Supabase
    reload();
  }, [reload]);

  useRealtime(flat.id, ["recurring_expenses"], reload);

  return { rules, error, reload };
}

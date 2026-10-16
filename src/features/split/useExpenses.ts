"use client";

import { useCallback, useEffect, useState } from "react";
import { useFlat } from "@/lib/flat-context";
import { DEMO_FLAT_ID } from "@/lib/mock";
import { useRealtime } from "@/lib/useRealtime";
import { getExpenses, type ExpenseWithShares } from "./api";
import { demoSplitExpenses } from "./demo";

/** Live list of the flat's expenses. Refetches whenever any flatmate changes an expense. */
export function useExpenses() {
  const { flat } = useFlat();
  const isDemo = flat.id === DEMO_FLAT_ID;
  const [expenses, setExpenses] = useState<ExpenseWithShares[] | null>(isDemo ? demoSplitExpenses : null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (isDemo) return;
    try {
      setExpenses(await getExpenses(flat.id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load expenses.");
    }
  }, [flat.id, isDemo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch from Supabase
    reload();
  }, [reload]);

  useRealtime(flat.id, isDemo ? [] : ["expenses", "expense_shares", "expense_changes"], reload);

  return { expenses, loading: expenses === null && !error, error, reload };
}

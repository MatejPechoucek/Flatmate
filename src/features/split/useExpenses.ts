"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useFlat } from "@/lib/flat-context";
import { DEMO_FLAT_ID } from "@/lib/mock";
import { useRealtime } from "@/lib/useRealtime";
import { getExpenses, type ExpenseWithShares } from "./api";
import { getDemoExpenses, subscribeDemo } from "./demoStore";

/** Live list of the flat's expenses. Refetches whenever any flatmate changes an expense. */
export function useExpenses() {
  const { flat } = useFlat();
  const isDemo = flat.id === DEMO_FLAT_ID;
  const [expenses, setExpenses] = useState<ExpenseWithShares[] | null>(null);
  // Demo flat: in-memory store (see demoStore), newest first, deleted ones hidden like the real query.
  // Server snapshot is empty: demo data is rendered in the browser only, so dates never mismatch on hydration.
  const allDemo = useSyncExternalStore(subscribeDemo, getDemoExpenses, () => null);
  const demoExpenses = useMemo(
    () => allDemo && allDemo.filter((e) => !e.deleted_at).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [allDemo],
  );
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

  const list = isDemo ? demoExpenses : expenses;
  return { expenses: list, loading: list === null && !error, error, reload };
}

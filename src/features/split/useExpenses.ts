"use client";

import { useCallback, useEffect, useState } from "react";
import { useFlat } from "@/lib/flat-context";
import { useRealtime } from "@/lib/useRealtime";
import { getExpenses, type ExpenseWithShares } from "./api";

/** Live list of the flat's expenses. Refetches whenever any flatmate changes an expense. */
export function useExpenses() {
  const { flat } = useFlat();
  const [expenses, setExpenses] = useState<ExpenseWithShares[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setExpenses(await getExpenses(flat.id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load expenses.");
    }
  }, [flat.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch from Supabase
    reload();
  }, [reload]);

  useRealtime(flat.id, ["expenses", "expense_shares", "expense_changes"], reload);

  return { expenses, loading: expenses === null && !error, error, reload };
}

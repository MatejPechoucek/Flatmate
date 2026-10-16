"use client";

import { useCallback, useEffect, useState } from "react";
import { useFlat } from "@/lib/flat-context";
import { useRealtime } from "@/lib/useRealtime";
import type { Settlement } from "@/lib/types";
import { getSettlements } from "./api";

/** Live list of the flat's recorded payments between flatmates. */
export function useSettlements() {
  const { flat } = useFlat();
  const [settlements, setSettlements] = useState<Settlement[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setSettlements(await getSettlements(flat.id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load payments.");
    }
  }, [flat.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch from Supabase
    reload();
  }, [reload]);

  useRealtime(flat.id, ["settlements"], reload);

  return { settlements, error, reload };
}

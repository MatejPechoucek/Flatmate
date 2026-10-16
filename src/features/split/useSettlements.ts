"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useFlat } from "@/lib/flat-context";
import { DEMO_FLAT_ID } from "@/lib/mock";
import { useRealtime } from "@/lib/useRealtime";
import type { Settlement } from "@/lib/types";
import { getSettlements } from "./api";
import { getDemoSettlements, subscribeDemoSettlements } from "./demoStore";

/** Live list of the flat's recorded payments between flatmates. */
export function useSettlements() {
  const { flat } = useFlat();
  const isDemo = flat.id === DEMO_FLAT_ID;
  const [settlements, setSettlements] = useState<Settlement[] | null>(null);
  // Demo flat: payments live in memory (see demoStore) instead of the database.
  const demoSettlements = useSyncExternalStore(subscribeDemoSettlements, getDemoSettlements, getDemoSettlements);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (isDemo) return;
    try {
      setSettlements(await getSettlements(flat.id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load payments.");
    }
  }, [flat.id, isDemo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch from Supabase
    reload();
  }, [reload]);

  useRealtime(flat.id, isDemo ? [] : ["settlements"], reload);

  return { settlements: isDemo ? demoSettlements : settlements, error, reload };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useFlat } from "@/lib/flat-context";
import { DEMO_FLAT_ID } from "@/lib/mock";
import { useRealtime } from "@/lib/useRealtime";
import type { Settlement } from "@/lib/types";
import { getSettlements } from "./api";
import { demoSettlements } from "./demo";

// Demo flat: payments recorded this session are kept in memory (reset on page refresh),
// so Settle up can be shown end to end without writing to Supabase.
let demoLog: Settlement[] = demoSettlements;

export function recordDemoSettlement(from: string, to: string, pence: number) {
  demoLog = [
    { id: `demo-${Date.now()}`, flat_id: DEMO_FLAT_ID, from_member: from, to_member: to, amount_pence: pence, created_at: new Date().toISOString() },
    ...demoLog,
  ];
}

/** Live list of the flat's recorded payments between flatmates. */
export function useSettlements() {
  const { flat } = useFlat();
  const isDemo = flat.id === DEMO_FLAT_ID;
  const [settlements, setSettlements] = useState<Settlement[] | null>(isDemo ? demoLog : null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (isDemo) return setSettlements(demoLog);
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

  return { settlements, error, reload };
}

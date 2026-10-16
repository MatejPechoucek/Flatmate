"use client";

import { useEffect, useRef } from "react";
import { supabase } from "./supabase";

/**
 * Calls `onChange` whenever any row of the given tables changes for this flat.
 * Typical use: refetch your screen's data.
 *
 *   useRealtime(flat.id, ["expenses", "expense_shares"], reload);
 *
 * Note: tables without a flat_id column (expense_shares, weight_votes) are
 * subscribed without a filter.
 */
export function useRealtime(flatId: string, tables: string[], onChange: () => void) {
  const callback = useRef(onChange);
  useEffect(() => {
    callback.current = onChange;
  });

  const tableKey = tables.join(",");

  useEffect(() => {
    if (!tableKey) return;
    const channel = supabase.channel(`flat:${flatId}:${tableKey}:${crypto.randomUUID()}`);
    for (const table of tableKey.split(",")) {
      const unfiltered = table === "expense_shares" || table === "weight_votes";
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(unfiltered ? {} : { filter: `flat_id=eq.${flatId}` }) },
        () => callback.current(),
      );
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [flatId, tableKey]);
}

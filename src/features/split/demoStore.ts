// Payments recorded in the demo flat. There's no database behind /flat/demo, so they live
// in memory for this tab: they survive switching tabs, and a page reload resets the demo.
import { DEMO_FLAT_ID } from "@/lib/mock";
import type { Settlement } from "@/lib/types";
import { demoSettlements } from "./demo";

let settlements: Settlement[] = demoSettlements;
const listeners = new Set<() => void>();

export function getDemoSettlements(): Settlement[] {
  return settlements;
}

export function subscribeDemoSettlements(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function addDemoSettlement(fromMember: string, toMember: string, pence: number): Settlement {
  const settlement: Settlement = {
    id: `demo-${crypto.randomUUID()}`,
    flat_id: DEMO_FLAT_ID,
    from_member: fromMember,
    to_member: toMember,
    amount_pence: pence,
    created_at: new Date().toISOString(),
  };
  settlements = [settlement, ...settlements]; // new array, so React sees the change
  listeners.forEach((l) => l());
  return settlement;
}

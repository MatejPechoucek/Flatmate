"use client";

import { useState } from "react";
import { Pause, Play, Repeat, Trash2 } from "lucide-react";
import { useFlat } from "@/lib/flat-context";
import { DEMO_FLAT_ID } from "@/lib/mock";
import { formatPence } from "@/lib/money";
import type { RecurringExpense } from "@/lib/types";
import { Avatar, Badge, Button, List, ListRow, Section } from "@/components/ui";
import { deleteRecurringExpense, setRecurringActive } from "./api";
import { demoDeleteRecurring, demoSetRecurringActive } from "./demoStore";

const nextLabel = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Recurring bill rules. Only the payer can pause, resume or delete their own bill. */
export function RecurringSection({ rules }: { rules: RecurringExpense[] | null }) {
  const { flat, me, memberName, realName } = useFlat();
  const isDemo = flat.id === DEMO_FLAT_ID; // demo flat: in-memory store
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!rules || rules.length === 0) return null; // created from the add sheet's Weekly/Monthly toggle

  async function run(id: string, action: () => Promise<void>) {
    setBusy(id);
    setError(null);
    try {
      await action();
      setConfirmingDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section title="Recurring bills">
      <List>
        {rules.map((r) => {
          const mine = r.payer_id === me.id;
          return (
            <ListRow
              key={r.id}
              leading={<Avatar name={realName(r.payer_id)} />}
              title={
                <span className={`inline-flex items-center gap-1.5 ${r.active ? "" : "text-muted"}`}>
                  <Repeat size={14} className="shrink-0 text-muted" />
                  {r.description}
                </span>
              }
              subtitle={
                r.active
                  ? `${formatPence(r.amount_pence)} ${r.interval} · ${memberName(r.payer_id)} pays · next ${nextLabel(r.next_due_at)}`
                  : `${formatPence(r.amount_pence)} ${r.interval} · paused`
              }
              trailing={
                !mine ? (
                  !r.active && <Badge>Paused</Badge>
                ) : confirmingDelete === r.id ? (
                  <div className="flex gap-1">
                    <Button size="sm" variant="danger" disabled={busy === r.id} onClick={() => run(r.id, async () => (isDemo ? demoDeleteRecurring(r.id) : deleteRecurringExpense(r.id)))}>
                      Delete
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setConfirmingDelete(null)}>
                      Keep
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy === r.id}
                      aria-label={r.active ? "Pause" : "Resume"}
                      onClick={() => run(r.id, async () => (isDemo ? demoSetRecurringActive(r.id, !r.active) : setRecurringActive(r.id, !r.active)))}
                    >
                      {r.active ? <Pause size={14} /> : <Play size={14} />}
                    </Button>
                    <Button size="sm" variant="secondary" aria-label="Delete" onClick={() => setConfirmingDelete(r.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )
              }
            />
          );
        })}
      </List>
      {error && <p className="mt-2 px-1 text-sm text-negative">{error}</p>}
      {confirmingDelete && <p className="mt-2 px-1 text-xs text-muted">Deleting stops future bills. Past ones stay in History.</p>}
    </Section>
  );
}

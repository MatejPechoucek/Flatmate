"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { useFlat } from "@/lib/flat-context";
import { DEMO_FLAT_ID } from "@/lib/mock";
import { formatPence, parsePounds, payLink } from "@/lib/money";
import { Avatar, Button, Input, Sheet } from "@/components/ui";
import { recordSettlement, type Transfer } from "./api";
import { addDemoSettlement } from "./demoStore";

/**
 * Pay a flatmate what you owe them: open their PayPal.me with the amount pre-filled, then
 * confirm. Mount only while open so each opening starts fresh.
 */
export function SettleUpSheet({ transfer, onClose, onSaved }: { transfer: Transfer; onClose: () => void; onSaved?: () => void }) {
  const { flat, members, me } = useFlat();
  const to = members.find((m) => m.id === transfer.to);
  const isDemo = flat.id === DEMO_FLAT_ID;
  const [amountText, setAmountText] = useState((transfer.pence / 100).toFixed(2));
  const [step, setStep] = useState<"pay" | "confirm">(to?.pay_handle ? "pay" : "confirm");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!to) return null;
  const pence = parsePounds(amountText);
  const problem =
    pence === null || pence <= 0
      ? "Enter an amount above £0"
      : pence > transfer.pence
        ? `That's more than you owe ${to.name} (${formatPence(transfer.pence)})`
        : null;

  function openPayment() {
    if (!to?.pay_handle || !pence) return;
    // Demo handles are made up and could belong to real people, so never send money there.
    if (!isDemo) window.open(payLink(to.pay_handle, pence), "_blank", "noopener");
    setStep("confirm");
  }

  async function confirm() {
    if (problem || !pence) return;
    if (isDemo) {
      addDemoSettlement(me.id, to!.id, pence);
      onSaved?.();
      return onClose();
    }
    setSaving(true);
    setError(null);
    try {
      await recordSettlement(flat.id, me.id, to!.id, pence);
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't record the payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Settle up">
      <div className="flex flex-col items-center gap-2 py-2">
        <Avatar name={to.name} size={64} />
        <p className="text-lg font-semibold">Pay {to.name}</p>
        <p className="text-sm text-muted">You owe {formatPence(transfer.pence)}</p>
      </div>

      <Input
        label="Amount"
        inputMode="decimal"
        className="text-center text-2xl font-semibold"
        value={amountText}
        onChange={(e) => setAmountText(e.target.value)}
      />
      {problem && <p className="-mt-2 text-sm text-negative">{problem}</p>}

      {step === "pay" ? (
        <>
          <Button onClick={openPayment} disabled={!!problem}>
            Open PayPal <ExternalLink size={16} />
          </Button>
          <Button variant="ghost" onClick={() => setStep("confirm")}>
            Paid another way (cash, bank transfer)
          </Button>
        </>
      ) : (
        <>
          {isDemo && to.pay_handle && (
            <p className="rounded-2xl bg-surface-2 p-4 text-sm text-muted">
              Demo flat: PayPal isn&apos;t opened. In a real flat this would open{" "}
              <span className="font-medium text-foreground">{payLink(to.pay_handle, pence ?? transfer.pence).replace("https://", "")}</span>.
            </p>
          )}
          {!to.pay_handle && (
            <p className="rounded-2xl bg-surface-2 p-4 text-sm text-muted">
              {to.name} hasn&apos;t added a PayPal.me link. Pay them by bank transfer or cash, then confirm here.
            </p>
          )}
          {error && <p className="text-sm text-negative">{error}</p>}
          <Button onClick={confirm} disabled={!!problem || saving}>
            {saving ? "Saving…" : `I've paid ${pence && !problem ? formatPence(pence) : ""}`}
          </Button>
          {to.pay_handle && (
            <Button variant="ghost" onClick={() => setStep("pay")}>
              Back to PayPal
            </Button>
          )}
        </>
      )}
      <p className="text-center text-xs text-muted">The money moves in PayPal or your bank. Here you just record that you paid.</p>
    </Sheet>
  );
}

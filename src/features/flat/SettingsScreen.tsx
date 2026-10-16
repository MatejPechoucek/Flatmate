"use client";

import { useEffect, useState, type FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy } from "lucide-react";
import { useFlat } from "@/lib/flat-context";
import { Avatar, Badge, Button, Card, Input, List, ListRow, Section, Sheet } from "@/components/ui";
import { formatPence, parsePounds } from "@/lib/money";
import { updateBuyoutRate } from "./api";

export function SettingsScreen() {
  const { flat, members, me, reload } = useFlat();
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- origin is only known in the browser
  useEffect(() => setOrigin(window.location.origin), []);
  const inviteUrl = `${origin}/join/${flat.invite_code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (e.g. http on a phone) — the code is on screen anyway.
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Section title="Invite flatmates">
        <Card className="flex flex-col items-center gap-4 py-6">
          <div className="rounded-2xl bg-white p-3">
            <QRCodeSVG value={inviteUrl} size={168} />
          </div>
          <p className="font-mono text-2xl font-semibold tracking-[0.3em]">{flat.invite_code}</p>
          <Button variant="secondary" className="w-full" onClick={copy}>
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy invite link"}
          </Button>
        </Card>
      </Section>

      <Section title={`Flatmates · ${members.length}`}>
        <List>
          {members.map((m) => (
            <ListRow
              key={m.id}
              leading={<Avatar name={m.name} />}
              title={m.name}
              subtitle={m.pay_handle ?? "No payment link"}
              trailing={m.id === me.id && <Badge tone="accent">You</Badge>}
            />
          ))}
        </List>
      </Section>

      <Section title="Chore buyouts">
        <List>
          <ListRow
            title="Price per effort point"
            subtitle="Bounty = weight × this"
            trailing={<span className="font-semibold">{formatPence(flat.buyout_rate_pence)}</span>}
            onClick={() => setRateOpen(true)}
          />
        </List>
      </Section>

      <RateSheet
        key={flat.buyout_rate_pence}
        open={rateOpen}
        onClose={() => setRateOpen(false)}
        flatId={flat.id}
        current={flat.buyout_rate_pence}
        onSaved={reload}
      />
    </div>
  );
}

function RateSheet({
  open,
  onClose,
  flatId,
  current,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  flatId: string;
  current: number;
  onSaved: () => Promise<void>;
}) {
  const [value, setValue] = useState((current / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pence = parsePounds(value);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!pence) return;
    setBusy(true);
    setError(null);
    try {
      await updateBuyoutRate(flatId, pence);
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save, try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Buyout rate">
      <form onSubmit={save} className="flex flex-col gap-4">
        <Input label="Price per effort point (£)" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        <p className="text-sm text-muted">
          {pence ? `A 5-point bathroom clean would cost ${formatPence(pence * 5)} to buy out.` : "Enter an amount like 1.00"}
        </p>
        {error && <p className="text-sm text-negative">{error}</p>}
        <Button type="submit" disabled={busy || !pence}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </form>
    </Sheet>
  );
}

"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy } from "lucide-react";
import { useFlat } from "@/lib/flat-context";
import { Avatar, Badge, Button, Card, List, ListRow, Section } from "@/components/ui";
import { formatPence } from "@/lib/money";

export function SettingsScreen() {
  const { flat, members, me } = useFlat();
  const [origin, setOrigin] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- origin is only known in the browser
  useEffect(() => setOrigin(window.location.origin), []);
  const inviteUrl = `${origin}/join/${flat.invite_code}`;

  return (
    <div className="flex flex-col gap-6">
      <Section title="Invite flatmates">
        <Card className="flex flex-col items-center gap-4 py-6">
          <div className="rounded-2xl bg-white p-3">
            <QRCodeSVG value={inviteUrl} size={168} />
          </div>
          <p className="font-mono text-2xl font-semibold tracking-[0.3em]">{flat.invite_code}</p>
          <Button variant="secondary" className="w-full" onClick={() => navigator.clipboard?.writeText(inviteUrl)}>
            <Copy size={16} /> Copy invite link
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
          <ListRow title="Price per effort point" subtitle="Bounty = weight × this" trailing={<span className="font-semibold">{formatPence(flat.buyout_rate_pence)}</span>} />
        </List>
      </Section>
    </div>
  );
}

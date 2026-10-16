"use client";

import type { ReactNode } from "react";
import { ArrowRightLeft, Coins, HandCoins, PencilLine, Receipt, Repeat } from "lucide-react";
import { Sheet } from "@/components/ui";

const topics: { icon: ReactNode; title: string; body: ReactNode }[] = [
  {
    icon: <Receipt size={20} />,
    title: "Adding an expense",
    body: (
      <>
        Give it a label, enter the total and pick who paid. Untick anyone who wasn&apos;t part of it. Split{" "}
        <b>equally</b>, <b>by £</b> or <b>by %</b>. With £ or %, the numbers have to add up before you can save.
      </>
    ),
  },
  {
    icon: <Coins size={20} />,
    title: "Odd pennies",
    body: <>When a total doesn&apos;t divide evenly (£10.01 between 4), the payer covers the leftover penny.</>,
  },
  {
    icon: <ArrowRightLeft size={20} />,
    title: "Why you might pay someone unexpected",
    body: (
      <>
        Balances are <b>simplified</b> to the fewest payments that settle the whole flat. If you owe Sam £5 and Sam owes
        Priya £5, you just pay Priya £5 and Sam is out of it. Everyone still ends up exactly even. Tap{" "}
        <b>All flat payments</b> to see the full plan.
      </>
    ),
  },
  {
    icon: <HandCoins size={20} />,
    title: "Settling up",
    body: (
      <>
        Tap <b>Settle up</b> to open their PayPal with the amount filled in. Once you&apos;ve paid, confirm it
        here and everyone&apos;s balances update. You can also pay part of what you owe, or pay by cash or bank
        transfer.
      </>
    ),
  },
  {
    icon: <Repeat size={20} />,
    title: "Recurring bills",
    body: <>Wi-Fi, energy, subscriptions: set them up once and they&apos;re added automatically every week or month.</>,
  },
  {
    icon: <PencilLine size={20} />,
    title: "Edits are visible",
    body: (
      <>
        Only the person who added an expense can edit or delete it. Anyone affected sees what changed, and the expense
        is marked <b>Edited</b>.
      </>
    ),
  },
];

export function SplitHelpSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet open onClose={onClose} title="How Split works">
      {topics.map((t) => (
        <div key={t.title} className="flex gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">{t.icon}</span>
          <div>
            <h3 className="font-semibold">{t.title}</h3>
            <p className="text-sm text-muted [&_b]:font-semibold [&_b]:text-foreground">{t.body}</p>
          </div>
        </div>
      ))}
    </Sheet>
  );
}

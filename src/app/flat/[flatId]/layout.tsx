"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { House, Receipt, Settings, Sparkles } from "lucide-react";
import { FlatProvider, useFlat } from "@/lib/flat-context";
import { AvatarStack } from "@/components/ui";

const tabs = [
  { href: "", label: "Home", icon: House },
  { href: "/split", label: "Split", icon: Receipt },
  { href: "/chores", label: "Chores", icon: Sparkles },
  { href: "/settings", label: "Flat", icon: Settings },
];

export default function FlatLayout({ children }: { children: ReactNode }) {
  const { flatId } = useParams<{ flatId: string }>();
  return (
    <FlatProvider flatId={flatId}>
      <Header />
      <main className="flex-1 px-4 pb-32 pt-2">{children}</main>
      <TabBar base={`/flat/${flatId}`} />
    </FlatProvider>
  );
}

function Header() {
  const { flat, members } = useFlat();
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between bg-background/85 px-5 pb-3 pt-6 backdrop-blur">
      <h1 className="truncate text-xl font-bold tracking-tight">{flat.name}</h1>
      <AvatarStack names={members.map((m) => m.name)} />
    </header>
  );
}

function TabBar({ base }: { base: string }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="grid grid-cols-4">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === base + href;
          return (
            <Link
              key={label}
              href={base + href}
              className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${active ? "text-accent" : "text-muted"}`}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

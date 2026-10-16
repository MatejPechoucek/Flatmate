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
  const pathname = usePathname();
  return (
    <FlatProvider flatId={flatId}>
      <Header />
      <main key={pathname} className="animate-rise-in flex-1 px-4 pb-36 pt-2">{children}</main>
      <TabBar base={`/flat/${flatId}`} />
    </FlatProvider>
  );
}

function Header() {
  const { flat, members } = useFlat();
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-background/90 px-5 pb-4 pt-[max(1.5rem,env(safe-area-inset-top))] backdrop-blur-md">
      <h1 className="truncate text-2xl font-bold tracking-tight">{flat.name}</h1>
      <AvatarStack names={members.map((m) => m.name)} />
    </header>
  );
}

function TabBar({ base }: { base: string }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <div className="grid grid-cols-4 px-2">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === base + href;
          return (
            <Link
              key={label}
              href={base + href}
              aria-current={active ? "page" : undefined}
              className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${active ? "text-accent" : "text-muted"}`}
            >
              <span className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${active ? "bg-accent-soft" : ""}`}>
                <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

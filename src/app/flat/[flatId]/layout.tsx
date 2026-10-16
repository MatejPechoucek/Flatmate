"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Home, House, Receipt, Settings, Sparkles } from "lucide-react";
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
      {/* Phone: header + bottom tab bar. Desktop (lg): left sidebar + centred content column. */}
      <div className="flex flex-1 flex-col lg:flex-row">
        <Sidebar base={`/flat/${flatId}`} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main key={pathname} className="animate-rise-in mx-auto w-full flex-1 px-4 pb-36 pt-2 lg:max-w-3xl lg:px-10 lg:pb-28">
            {children}
          </main>
        </div>
      </div>
      <TabBar base={`/flat/${flatId}`} />
    </FlatProvider>
  );
}

function Header() {
  const { flat, members } = useFlat();
  return (
    <header className="sticky top-0 z-10 mx-auto flex w-full items-center justify-between gap-4 bg-background/90 px-5 pb-4 pt-[max(1.5rem,env(safe-area-inset-top))] backdrop-blur-md lg:max-w-3xl lg:px-11 lg:pb-6 lg:pt-10">
      <h1 className="truncate text-2xl font-bold tracking-tight lg:text-3xl">{flat.name}</h1>
      <AvatarStack names={members.map((m) => m.name)} />
    </header>
  );
}

function TabBar({ base }: { base: string }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
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

/** Desktop navigation: replaces the bottom tab bar from lg up. */
function Sidebar({ base }: { base: string }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-8 border-r border-border px-4 py-8 lg:flex">
      <Link href="/" className="flex items-center gap-2.5 px-3 text-lg font-bold tracking-tight">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-fg">
          <Home size={18} />
        </span>
        Flatmate
      </Link>
      <nav className="flex flex-col gap-1">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === base + href;
          return (
            <Link
              key={label}
              href={base + href}
              aria-current={active ? "page" : undefined}
              className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
                active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

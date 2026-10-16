"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Home, Receipt, Sparkles } from "lucide-react";
import { Button, Card, Input, SegmentedControl } from "@/components/ui";
import { DEMO_FLAT_ID } from "@/lib/mock";

export function LandingScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");

  // TODO: create flat + member in Supabase, setMemberId, then route to /flat/[id].
  const enterDemo = () => router.push(`/flat/${DEMO_FLAT_ID}`);

  return (
    <main className="flex flex-1 flex-col px-5 pb-10 pt-16">
      <div className="mb-10">
        <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-fg">
          <Home size={28} />
        </div>
        <h1 className="text-4xl font-bold leading-tight tracking-tight">
          Flat life,
          <br />
          minus the awkward.
        </h1>
        <p className="mt-3 text-lg text-muted">Split bills and share chores fairly. The app does the chasing, so you don&apos;t have to.</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3">
        <Card className="flex flex-col gap-2">
          <Receipt className="text-accent" size={22} />
          <span className="text-sm font-medium">Split anything, equally or your way</span>
        </Card>
        <Card className="flex flex-col gap-2">
          <Sparkles className="text-accent" size={22} />
          <span className="text-sm font-medium">Chores assigned fairly, automatically</span>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <SegmentedControl
          options={[
            { value: "create", label: "Create a flat" },
            { value: "join", label: "Join a flat" },
          ]}
          value={mode}
          onChange={setMode}
        />
        {mode === "create" ? (
          <>
            <Input label="Flat name" placeholder="14 Gower Street" />
            <Input label="Your name" placeholder="Alex" />
            <Button onClick={enterDemo}>Create flat</Button>
          </>
        ) : (
          <>
            <Input label="Invite code" placeholder="K7PX2Q" className="font-mono uppercase tracking-widest" />
            <Button onClick={enterDemo}>Continue</Button>
          </>
        )}
      </div>

      <button onClick={enterDemo} className="mt-auto pt-10 text-sm font-medium text-accent">
        Peek at a demo flat →
      </button>
    </main>
  );
}

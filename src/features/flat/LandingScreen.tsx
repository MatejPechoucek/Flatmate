"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Home, Receipt, Sparkles } from "lucide-react";
import { Button, Card, Input, SegmentedControl } from "@/components/ui";
import { DEMO_FLAT_ID } from "@/lib/mock";
import { createFlat } from "./api";

export function LandingScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [flatName, setFlatName] = useState("");
  const [name, setName] = useState("");
  const [payHandle, setPayHandle] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enterDemo = () => router.push(`/flat/${DEMO_FLAT_ID}`);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { flat } = await createFlat({ flatName, memberName: name, payHandle });
      // Land on settings so the creator can show the QR code straight away.
      router.push(`/flat/${flat.id}/settings`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong, try again");
      setBusy(false);
    }
  };

  const onJoin = (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c) router.push(`/join/${c}`);
  };

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
          onChange={(m) => {
            setMode(m);
            setError(null);
          }}
        />
        {mode === "create" ? (
          <form onSubmit={onCreate} className="flex flex-col gap-4">
            <Input label="Flat name" placeholder="14 Gower Street" value={flatName} onChange={(e) => setFlatName(e.target.value)} required />
            <Input label="Your name" placeholder="Alex" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input
              label="PayPal.me username (optional)"
              placeholder="so flatmates can pay you back"
              value={payHandle}
              onChange={(e) => setPayHandle(e.target.value)}
              autoCapitalize="none"
            />
            {error && <p className="text-sm text-negative">{error}</p>}
            <Button type="submit" disabled={busy || !flatName.trim() || !name.trim()}>
              {busy ? "Creating…" : "Create flat"}
            </Button>
          </form>
        ) : (
          <form onSubmit={onJoin} className="flex flex-col gap-4">
            <Input
              label="Invite code"
              placeholder="K7PX2Q"
              className="font-mono uppercase tracking-widest"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
            />
            <Button type="submit" disabled={code.trim().length < 6}>
              Continue
            </Button>
          </form>
        )}
      </div>

      <button onClick={enterDemo} className="mt-auto pt-10 text-sm font-medium text-accent">
        Peek at a demo flat →
      </button>
    </main>
  );
}

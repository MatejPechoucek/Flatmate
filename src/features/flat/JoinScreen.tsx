"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Avatar, AvatarStack, Button, EmptyState, Input } from "@/components/ui";
import { getMemberId, setMemberId } from "@/lib/identity";
import type { Flat, Member } from "@/lib/types";
import { findFlatByCode, joinFlat } from "./api";

type Lookup = { status: "loading" } | { status: "missing" } | { status: "found"; flat: Flat; members: Member[] };

export function JoinScreen() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [lookup, setLookup] = useState<Lookup>({ status: "loading" });
  const [name, setName] = useState("");
  const [payHandle, setPayHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    findFlatByCode(code)
      .then((res) => {
        if (cancelled) return;
        if (!res) return setLookup({ status: "missing" });
        // Already a member on this device? Skip straight in.
        const myId = getMemberId(res.flat.id);
        if (myId && res.members.some((m) => m.id === myId)) return router.replace(`/flat/${res.flat.id}`);
        setLookup({ status: "found", ...res });
      })
      .catch(() => !cancelled && setLookup({ status: "missing" }));
    return () => {
      cancelled = true;
    };
  }, [code, router]);

  if (lookup.status === "loading") return <p className="p-6 text-center text-muted">Finding your flat…</p>;

  if (lookup.status === "missing")
    return (
      <main className="flex flex-1 flex-col justify-center gap-4 px-5">
        <EmptyState>
          We couldn&apos;t find a flat with code <span className="font-mono font-semibold">{code.toUpperCase()}</span>. Double-check it with
          whoever invited you.
        </EmptyState>
        <Link href="/" className="text-center text-sm font-medium text-accent">
          ← Back to start
        </Link>
      </main>
    );

  const { flat, members } = lookup;

  const onJoin = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await joinFlat(flat.id, { name, payHandle });
      router.push(`/flat/${flat.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong, try again");
      setBusy(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col px-5 pb-10 pt-16">
      <p className="text-sm font-medium text-muted">You&apos;ve been invited to</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">{flat.name}</h1>
      {members.length > 0 && (
        <div className="mt-4 flex items-center gap-3">
          <AvatarStack names={members.map((m) => m.name)} />
          <span className="text-sm text-muted">
            {members.length} {members.length === 1 ? "flatmate" : "flatmates"} already here
          </span>
        </div>
      )}

      <form onSubmit={onJoin} className="mt-10 flex flex-col gap-4">
        <Input label="Your name" placeholder="What do your flatmates call you?" autoFocus value={name} onChange={(e) => setName(e.target.value)} required />
        <Input
          label="PayPal.me username (optional)"
          placeholder="so flatmates can pay you back"
          value={payHandle}
          onChange={(e) => setPayHandle(e.target.value)}
          autoCapitalize="none"
        />
        {error && <p className="text-sm text-negative">{error}</p>}
        <Button type="submit" disabled={busy || !name.trim()}>
          {busy ? "Joining…" : "Join flat"}
        </Button>
      </form>

      {members.length > 0 && (
        <div className="mt-10">
          <p className="mb-3 text-sm font-medium text-muted">Already in this flat? Tap your name</p>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setMemberId(flat.id, m.id);
                  router.push(`/flat/${flat.id}`);
                }}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-surface-2 pl-1.5 pr-4 text-sm font-medium transition active:scale-95"
              >
                <Avatar name={m.name} size={32} />
                {m.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-auto pt-10 text-center font-mono text-xs tracking-widest text-muted">CODE {flat.invite_code}</p>
    </main>
  );
}

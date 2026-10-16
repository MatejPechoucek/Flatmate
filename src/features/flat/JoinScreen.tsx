"use client";

import { useParams, useRouter } from "next/navigation";
import { AvatarStack, Button, Input } from "@/components/ui";
import { DEMO_FLAT_ID, demoFlat, demoMembers } from "@/lib/mock";

export function JoinScreen() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  // TODO: look up flat by invite code, insert member, setMemberId, route to /flat/[id].
  const flat = demoFlat;

  return (
    <main className="flex flex-1 flex-col px-5 pb-10 pt-16">
      <p className="text-sm font-medium text-muted">You&apos;ve been invited to</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">{flat.name}</h1>
      <div className="mt-4 flex items-center gap-3">
        <AvatarStack names={demoMembers.map((m) => m.name)} />
        <span className="text-sm text-muted">{demoMembers.length} flatmates already here</span>
      </div>

      <div className="mt-10 flex flex-col gap-4">
        <Input label="Your name" placeholder="What do your flatmates call you?" autoFocus />
        <Input label="PayPal.me username (optional)" placeholder="so flatmates can pay you back" />
        <Button onClick={() => router.push(`/flat/${DEMO_FLAT_ID}`)}>Join flat</Button>
      </div>

      <p className="mt-auto pt-10 text-center font-mono text-xs tracking-widest text-muted">CODE {code.toUpperCase()}</p>
    </main>
  );
}

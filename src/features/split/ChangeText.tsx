"use client";

import { Fragment, type ReactNode } from "react";
import { useFlat } from "@/lib/flat-context";
import { formatPence } from "@/lib/money";
import type { ExpenseChange } from "@/lib/types";
import { diffFor } from "./api";

/**
 * One change in plain words, from the viewer's point of view, e.g.
 * "Priya changed Cleaning supplies: £9.50 → £11.50 · your share £2.85 → £3.45".
 * `withName` = false omits the expense name (used inside that expense's own history).
 */
export function ChangeText({ change: c, withName = true }: { change: ExpenseChange; withName?: boolean }) {
  const { me, memberName } = useFlat();
  const who = <b>{memberName(c.changed_by)}</b>;
  const name = <b>{(c.after ?? c.before).description}</b>;

  if (c.kind === "delete") {
    const myShare = c.before.shares[me.id];
    return (
      <>
        {who} deleted {withName ? <>{name} </> : "it "}({formatPence(c.before.amount_pence)})
        {myShare ? <> · your share was {formatPence(myShare)}</> : null}
      </>
    );
  }

  const parts: ReactNode[] = diffFor(c, me.id).map((d) => {
    switch (d.field) {
      case "description":
        return <>label &ldquo;{d.from}&rdquo; → &ldquo;{d.to}&rdquo;</>;
      case "amount":
        return <>{formatPence(d.from)} → {formatPence(d.to)}</>;
      case "payer":
        return <>payer {memberName(d.from)} → {memberName(d.to)}</>;
      case "yourShare":
        return d.to === 0 ? <>you were removed (was {formatPence(d.from)})</> : d.from === 0 ? <>you were added ({formatPence(d.to)})</> : <>your share {formatPence(d.from)} → {formatPence(d.to)}</>;
      case "splitOnly":
        return <>the split</>;
    }
  });

  return (
    <>
      {who} changed {withName && <>{name}: </>}
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && " · "}
          {p}
        </Fragment>
      ))}
    </>
  );
}

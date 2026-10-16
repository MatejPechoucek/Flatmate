"use client";

import { PencilLine, Trash2, X } from "lucide-react";
import { timeAgo } from "@/lib/dates";
import type { ExpenseChange } from "@/lib/types";
import { ChangeText } from "./ChangeText";

/** "Alex changed Tesco shop: …" cards at the top of Split. Tap to open, ✕ to dismiss. */
export function NoticesBanner({
  notices,
  onDismiss,
  onOpen,
}: {
  notices: ExpenseChange[];
  onDismiss: (id: string) => void;
  onOpen: (expenseId: string) => void;
}) {
  if (notices.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {notices.map((n) => (
        <div key={n.id} className="flex items-start gap-3 rounded-2xl bg-warning-soft p-3 pr-2">
          <span className="mt-0.5 text-warning">{n.kind === "delete" ? <Trash2 size={18} /> : <PencilLine size={18} />}</span>
          <button
            className="min-w-0 flex-1 text-left text-sm [&_b]:font-semibold"
            onClick={() => n.kind === "edit" && onOpen(n.expense_id)}
          >
            <ChangeText change={n} />
            <span className="mt-0.5 block text-xs text-muted">{timeAgo(n.created_at)}</span>
          </button>
          <button onClick={() => onDismiss(n.id)} className="rounded-full p-1 text-muted hover:bg-surface-2" aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

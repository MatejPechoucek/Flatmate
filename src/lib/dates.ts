const DAY = 86_400_000;

/** "Today", "Yesterday", "3 days ago", "12 Oct" */
export function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Due label + whether it's overdue: "Due today", "Due tomorrow", "Due in 3 days", "Overdue". */
export function dueLabel(iso: string | null): { text: string; overdue: boolean } {
  if (!iso) return { text: "No due date", overdue: false };
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / DAY);
  if (days < 0) return { text: "Overdue", overdue: true };
  if (days === 0) return { text: "Due today", overdue: false };
  if (days === 1) return { text: "Due tomorrow", overdue: false };
  return { text: `Due in ${days} days`, overdue: false };
}

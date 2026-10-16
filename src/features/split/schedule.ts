// Pure date maths for recurring bills — no runtime imports, unit-tested with `node --test`.
// Dates are handled in UTC so every flatmate's device computes the same schedule.

export type Interval = "weekly" | "monthly";

/**
 * The next due date after `iso`. Monthly keeps the day of month, clamped to shorter months
 * (31 Jan → 28/29 Feb). Note: after a clamp the bill stays on the earlier day (28 Feb → 28 Mar).
 */
export function nextDue(iso: string, interval: Interval): string {
  const d = new Date(iso);
  if (interval === "weekly") {
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString();
  }
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const daysInMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, daysInMonth));
  return d.toISOString();
}

/** Every due date in (…, now], starting at `firstDue`. Capped so a bad date can't flood the flat. */
export function dueDatesUntil(firstDue: string, interval: Interval, now: Date, max = 24): string[] {
  const out: string[] = [];
  let due = firstDue;
  while (new Date(due) <= now && out.length < max) {
    out.push(due);
    due = nextDue(due, interval);
  }
  return out;
}

/** "Wi-Fi" → "Wi-Fi · Oct" (monthly) or "Wi-Fi · 12 Oct" (weekly), so occurrences are distinguishable. */
export function occurrenceLabel(description: string, dueIso: string, interval: Interval): string {
  const d = new Date(dueIso);
  const month = d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  return interval === "monthly" ? `${description} · ${month}` : `${description} · ${d.getUTCDate()} ${month}`;
}

/** A yyyy-mm-dd date input value → that day at 00:00 UTC (ISO). */
export function startOfDayIso(dateInput: string): string {
  return new Date(`${dateInput}T00:00:00Z`).toISOString();
}

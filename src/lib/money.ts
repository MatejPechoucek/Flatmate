const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

/** 1234 → "£12.34" */
export function formatPence(pence: number): string {
  return gbp.format(pence / 100);
}

/** "12.34" | "£12.3" | "12" → 1234. Returns null for invalid input. */
export function parsePounds(input: string): number | null {
  const cleaned = input.replace(/[£,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  return Math.round(parseFloat(cleaned) * 100);
}

/** Monzo.me link with the amount pre-filled, falling back to PayPal.me. */
export function payLink(handle: string, pence: number): string {
  const amount = (pence / 100).toFixed(2);
  return handle.startsWith("paypal:")
    ? `https://paypal.me/${handle.slice(7)}/${amount}GBP`
    : `https://monzo.me/${handle}/${amount}`;
}

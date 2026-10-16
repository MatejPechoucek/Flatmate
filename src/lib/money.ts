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

/** PayPal.me username from whatever was typed: "priyak", "@priyak" or "paypal.me/priyak". */
export function normalizePayHandle(input: string): string {
  return input.trim().replace(/^(https?:\/\/)?(www\.)?paypal\.me\//i, "").replace(/^@/, "").split(/[/?#]/)[0];
}

/** PayPal.me link with the amount pre-filled in GBP. */
export function payLink(handle: string, pence: number): string {
  return `https://paypal.me/${encodeURIComponent(normalizePayHandle(handle))}/${(pence / 100).toFixed(2)}GBP`;
}

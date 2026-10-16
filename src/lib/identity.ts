// "Who am I in this flat" is remembered per device — no accounts.

const keyFor = (flatId: string) => `flatmate:member:${flatId}`;

export function getMemberId(flatId: string): string | null {
  try {
    return localStorage.getItem(keyFor(flatId));
  } catch {
    return null;
  }
}

export function setMemberId(flatId: string, memberId: string): void {
  try {
    localStorage.setItem(keyFor(flatId), memberId);
  } catch {
    // Storage unavailable (private mode) — user will be asked to rejoin.
  }
}

export function clearMemberId(flatId: string): void {
  try {
    localStorage.removeItem(keyFor(flatId));
  } catch {}
}

export function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => alphabet[b % alphabet.length]).join("");
}

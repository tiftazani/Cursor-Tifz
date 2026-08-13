export const COOKIE_NAME = "cuan_auth";

export function getSitePassword(): string {
  return process.env.SITE_PASSWORD || "Cuan2026";
}

export async function sessionToken(password = getSitePassword()): Promise<string> {
  const data = new TextEncoder().encode(`cuan-session-v1:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function isValidSession(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  return token === (await sessionToken());
}

const attempts = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(ip: string, limit = 8, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const row = attempts.get(ip);
  if (!row || now > row.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  row.count += 1;
  return row.count <= limit;
}

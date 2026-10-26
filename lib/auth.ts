import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "cases_admin";
const MAX_AGE = 60 * 60 * 24 * 30;

function secret(): string {
  return process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "cases-dev-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function equal(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function checkPassword(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return equal(candidate, expected);
}

export function makeToken(): string {
  const issued = Date.now();
  return `${issued}.${sign(String(issued))}`;
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const [issued, signature] = token.split(".");
  if (!issued || !signature) return false;
  if (!equal(signature, sign(issued))) return false;
  const age = Date.now() - Number(issued);
  return age >= 0 && age < MAX_AGE * 1000;
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifyToken(store.get(SESSION_COOKIE)?.value);
}

export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  };
}

const attempts = new Map<string, { count: number; first: number }>();

/** Anti-brute-force par instance (serverless: par conteneur). Le vrai garde-fou reste un mot de passe long. */
export function rateLimit(key: string, limit = 8, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.first > windowMs) {
    attempts.set(key, { count: 1, first: now });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

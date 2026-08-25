import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";

const JWT_SECRET: string = (() => {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET must be set");
  return value;
})();

export interface SessionPayload {
  userId: string;
  role: Role;
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
}

export function verifySession(token: string): SessionPayload {
  return jwt.verify(token, JWT_SECRET) as SessionPayload;
}

export const SESSION_COOKIE = "ag_session";

// Cookie attributes shared between setting the session (with maxAge) and
// clearing it (without) — they must match on both sides or the browser
// won't recognize a clearCookie call as targeting the same cookie.
// `secure` defaults to on outside plain local dev: once this app is reached
// over a real domain (a Cloudflare Tunnel, a reverse proxy, an actual
// deployment) the browser sees an HTTPS origin and increasingly refuses to
// even store a non-Secure cookie, so hardcoding `secure: false` would break
// login the moment this stops being http://localhost. Override with
// COOKIE_SECURE=false only if you're intentionally serving over plain HTTP
// on a real domain (not recommended).
const secureCookie = process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === "true"
  : process.env.NODE_ENV === "production";

export function sessionCookieOptions(maxAge?: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: secureCookie,
    ...(maxAge !== undefined ? { maxAge } : {}),
  };
}

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
// server/.env.example ships COOKIE_SECURE=false explicitly, since a plain
// HTTP deployment (a bare VM on a LAN, no TLS in front of it) is the
// common case here. The NODE_ENV fallback below only kicks in if someone
// removes that line entirely — set COOKIE_SECURE=true once this is
// actually reached over HTTPS (a real domain + cert, a reverse proxy, a
// tunnel), since browsers increasingly refuse to even store a non-Secure
// cookie from an HTTPS page, which would otherwise break login.
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

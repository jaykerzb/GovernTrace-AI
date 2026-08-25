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

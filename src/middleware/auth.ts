import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";

const VALID_ROLES = ["admin", "teacher", "student"] as const;

/**
 * Optional JWT auth: when AUTH_JWT_SECRET is set and Authorization: Bearer <jwt>
 * is present with payload `{ role: "admin" | "teacher" | "student" }`, sets
 * req.user for downstream middleware (e.g. role-based Arcjet limits).
 */
const authMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) {
    return next();
  }

  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return next();
  }

  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, secret) as { role?: string };
    if (
      payload.role &&
      (VALID_ROLES as readonly string[]).includes(payload.role)
    ) {
      req.user = {
        role: payload.role as (typeof VALID_ROLES)[number],
      };
    }
  } catch {
    // Invalid or expired token: leave req.user unset (guest rate limits).
  }
  next();
};

export default authMiddleware;

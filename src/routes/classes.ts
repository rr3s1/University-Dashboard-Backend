import { randomBytes } from "node:crypto";

import express from "express";
import { eq, sql } from "drizzle-orm";

import { db } from "../db/index.js";
import { classes, subjects, user } from "../db/schema/index.js";

const router = express.Router();

/** Walk Drizzle `DrizzleQueryError`, Neon `NeonDbError`, and nested `cause` / `sourceError`. */
function readPostgresErrorCode(err: unknown): string | undefined {
  let current: unknown = err;
  const seen = new Set<unknown>();
  for (let i = 0; i < 10 && current && typeof current === "object" && !seen.has(current); i++) {
    seen.add(current);
    const o = current as Record<string, unknown>;
    const code = o.code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) {
      return code;
    }
    current = o.cause ?? o.sourceError;
  }
  return undefined;
}

function readPostgresErrorFields(err: unknown): {
  code?: string;
  message?: string;
  detail?: string;
} {
  let current: unknown = err;
  const seen = new Set<unknown>();
  for (let i = 0; i < 10 && current && typeof current === "object" && !seen.has(current); i++) {
    seen.add(current);
    const o = current as Record<string, unknown>;
    if (typeof o.code === "string" || typeof o.message === "string" || typeof o.detail === "string") {
      return {
        ...(typeof o.code === "string" ? { code: o.code } : {}),
        ...(typeof o.message === "string" ? { message: o.message } : {}),
        ...(typeof o.detail === "string" ? { detail: o.detail } : {}),
      };
    }
    current = o.cause ?? o.sourceError;
  }
  return {};
}

const CLASS_STATUSES = ["active", "inactive", "archived"] as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Picks and validates only allowed class fields from the request body (no mass-assignment). */
function parseCreateClassBody(body: unknown):
  | {
      ok: true;
      fields: {
        name: string;
        subjectId: number;
        teacherId: string;
        description?: string;
        bannerCldPubId?: string;
        bannerUrl?: string;
        capacity?: number;
        status?: (typeof CLASS_STATUSES)[number];
        startDate?: Date;
      };
    }
  | { ok: false; message: string } {
  if (!isRecord(body)) {
    return { ok: false, message: "Request body must be a JSON object" };
  }

  const nameRaw = body.name;
  if (typeof nameRaw !== "string" || nameRaw.trim().length === 0) {
    return { ok: false, message: "name is required" };
  }
  const name = nameRaw.trim();
  if (name.length > 255) {
    return { ok: false, message: "name must be at most 255 characters" };
  }

  const teacherIdRaw = body.teacherId;
  let teacherId: string;
  if (typeof teacherIdRaw === "string" && teacherIdRaw.trim().length > 0) {
    teacherId = teacherIdRaw.trim();
  } else if (typeof teacherIdRaw === "number" && Number.isFinite(teacherIdRaw)) {
    teacherId = String(teacherIdRaw);
  } else {
    return { ok: false, message: "teacherId is required" };
  }

  const subjectIdRaw = body.subjectId;
  const subjectId =
    typeof subjectIdRaw === "number"
      ? subjectIdRaw
      : typeof subjectIdRaw === "string"
        ? Number(subjectIdRaw)
        : NaN;
  if (!Number.isInteger(subjectId) || subjectId < 1) {
    return { ok: false, message: "subjectId must be a positive integer" };
  }

  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== "string") {
      return { ok: false, message: "description must be a string" };
    }
  }

  const description =
    typeof body.description === "string" ? body.description : undefined;

  let startDate: Date | undefined;
  if (body.startDate !== undefined && body.startDate !== null) {
    const sd = body.startDate;
    const asDate =
      sd instanceof Date
        ? sd
        : typeof sd === "string" || typeof sd === "number"
          ? new Date(sd)
          : null;
    if (!asDate || Number.isNaN(asDate.getTime())) {
      return { ok: false, message: "startDate must be a valid date" };
    }
    startDate = asDate;
  }

  let bannerCldPubId: string | undefined;
  if (body.bannerCldPubId !== undefined && body.bannerCldPubId !== null) {
    if (typeof body.bannerCldPubId !== "string") {
      return { ok: false, message: "bannerCldPubId must be a string" };
    }
    bannerCldPubId = body.bannerCldPubId;
  }

  let bannerUrl: string | undefined;
  if (body.bannerUrl !== undefined && body.bannerUrl !== null) {
    if (typeof body.bannerUrl !== "string") {
      return { ok: false, message: "bannerUrl must be a string" };
    }
    bannerUrl = body.bannerUrl;
  }

  let capacity: number | undefined;
  if (body.capacity !== undefined && body.capacity !== null) {
    const cap =
      typeof body.capacity === "number"
        ? body.capacity
        : typeof body.capacity === "string"
          ? Number(body.capacity)
          : NaN;
    if (!Number.isInteger(cap) || cap < 1) {
      return { ok: false, message: "capacity must be a positive integer" };
    }
    capacity = cap;
  }

  let status: (typeof CLASS_STATUSES)[number] | undefined;
  if (body.status !== undefined && body.status !== null) {
    if (typeof body.status !== "string" || !CLASS_STATUSES.includes(body.status as (typeof CLASS_STATUSES)[number])) {
      return {
        ok: false,
        message: `status must be one of: ${CLASS_STATUSES.join(", ")}`,
      };
    }
    status = body.status as (typeof CLASS_STATUSES)[number];
  }

  return {
    ok: true,
    fields: {
      name,
      subjectId,
      teacherId,
      ...(description !== undefined ? { description } : {}),
      ...(bannerCldPubId !== undefined ? { bannerCldPubId } : {}),
      ...(bannerUrl !== undefined ? { bannerUrl } : {}),
      ...(capacity !== undefined ? { capacity } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(startDate !== undefined ? { startDate } : {}),
    },
  };
}

router.post("/", async (req, res) => {
  try {
    const parsed = parseCreateClassBody(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.message });
    }

    const [subjectRow] = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(eq(subjects.id, parsed.fields.subjectId))
      .limit(1);
    if (!subjectRow) {
      return res.status(400).json({ error: "Subject does not exist" });
    }

    const [teacherRow] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, parsed.fields.teacherId))
      .limit(1);
    if (!teacherRow) {
      return res.status(400).json({ error: "Teacher does not exist" });
    }

    const returning = {
      id: classes.id,
      name: classes.name,
      subjectId: classes.subjectId,
      teacherId: classes.teacherId,
      description: classes.description,
      inviteCode: classes.inviteCode,
      schedules: classes.schedules,
      capacity: classes.capacity,
      status: classes.status,
      bannerUrl: classes.bannerUrl,
      bannerCldPubId: classes.bannerCldPubId,
      startDate: classes.startDate,
      createdAt: classes.createdAt,
      updatedAt: classes.updatedAt,
    };

    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const inviteCode = randomBytes(12).toString("base64url").slice(0, 16);
      const insertValues = {
        ...parsed.fields,
        inviteCode,
        /** Explicit JSON so Neon/Drizzle never relies on a mismatched DB default for `schedules`. */
        schedules: sql`'[]'::jsonb`,
      };

      try {
        const [createdClass] = await db
          .insert(classes)
          .values(insertValues)
          .returning(returning);

        if (!createdClass) {
          throw new Error("Insert returned no row");
        }

        return res.status(201).json({ data: createdClass });
      } catch (e) {
        const pgCode = readPostgresErrorCode(e);
        if (pgCode === "23505" && attempt < maxAttempts - 1) {
          continue;
        }
        if (pgCode === "23503") {
          return res.status(400).json({
            error: "Invalid subject or teacher (foreign key violation)",
          });
        }
        if (pgCode === "23505") {
          return res.status(409).json({
            error: "Could not allocate a unique invite code; try again",
          });
        }
        throw e;
      }
    }

    return res.status(409).json({
      error: "Could not allocate a unique invite code; try again",
    });
  } catch (e) {
    const pg = readPostgresErrorFields(e);
    console.error(`POST /classes error`, e, pg);

    const pgCode = readPostgresErrorCode(e);
    if (pgCode === "42703") {
      return res.status(503).json({
        error:
          "Database schema is missing a column this API expects (e.g. `classes.start_date`). From `craft-backend` run `npm run db:migrate` (applies migration `0004_classes_start_date_if_missing` if needed). In Neon you can also run: ALTER TABLE classes ADD COLUMN IF NOT EXISTS start_date timestamp;",
      });
    }

    const exposePg = process.env.NODE_ENV !== "production";
    res.status(500).json({
      error: "Failed to create class",
      ...(exposePg && (pg.code || pg.detail || pg.message)
        ? { postgres: { code: pg.code, detail: pg.detail, message: pg.message } }
        : {}),
    });
  }
});

export default router;

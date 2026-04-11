import express from "express";
import { db } from "../db/index.js";
import { classes } from "../db/schema/index.js";

const router = express.Router();

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
  if (typeof teacherIdRaw !== "string" || teacherIdRaw.trim().length === 0) {
    return { ok: false, message: "teacherId is required" };
  }
  const teacherId = teacherIdRaw.trim();

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

    const inviteCode = Math.random().toString(36).substring(2, 9);
    const schedules = [] as Record<string, unknown>[];

    const insertValues = {
      ...parsed.fields,
      inviteCode,
      schedules,
    };

    const [createdClass] = await db
      .insert(classes)
      .values(insertValues)
      .returning({
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
      });

    if (!createdClass) {
      throw new Error("Insert returned no row");
    }

    res.status(201).json({ data: createdClass });
  } catch (e) {
    console.error(`POST /classes error ${e}`);
    res.status(500).json({ error: "Failed to create class" });
  }
});

export default router;

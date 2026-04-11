import express from "express";
import { user } from "../db/schema/index.js";
import { desc, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { parsePaginationQuery } from "../lib/pagination.js";

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const query = _req.query as Record<string, unknown>;
    const parsed = parsePaginationQuery(query.page, query.limit);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }
    const { currentPage, limitPerPage, offset } = parsed;

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(user);

    const totalCount = Number(countResult[0]?.count ?? 0);

    const rows = await db
      .select({
        id: user.id,
        name: user.name,
        image: user.image,
        role: user.role,
        imageCldPubId: user.imageCldPubId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .orderBy(desc(user.createdAt))
      .limit(limitPerPage)
      .offset(offset);

    return res.status(200).json({
      data: rows,
      pagination: {
        page: currentPage,
        limit: limitPerPage,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitPerPage) || 1,
      },
    });
  } catch (e) {
    console.error("GET /users error:", e);
    return res.status(500).json({ error: "Failed to get users" });
  }
});

export default router;

import express from "express";
import { user } from "../db/schema/index.js";
import { desc, sql } from "drizzle-orm";
import { db } from "../db/index.js";

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const query = _req.query as Record<string, unknown>;
    const pageRaw = query.page;
    const limitRaw = query.limit;
    const pageStr = Array.isArray(pageRaw) ? pageRaw[0] : pageRaw;
    const limitStr = Array.isArray(limitRaw) ? limitRaw[0] : limitRaw;

    const currentPage = Math.max(1, Number(pageStr ?? 1));
    const limitPerPage = Math.max(1, Number(limitStr ?? 10));
    const offset = (currentPage - 1) * limitPerPage;

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(user);

    const totalCount = Number(countResult[0]?.count ?? 0);

    const rows = await db
      .select()
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

import express from 'express';
import { subjects, departments } from '../db/schema';
import { ilike, or, and, sql, eq, getTableColumns, desc } from 'drizzle-orm';
import { db } from '../db';


const router = express.Router();

// Get all subjects with optional search, filtering and pagination

router.get('/', async (req, res) => {
try {
    const query = req.query as Record<string, unknown>;
    const search = typeof query.search === 'string' ? query.search : undefined;

    // Support both `filter` (old usage) and `department` (more explicit) query params.
    const department =
      typeof query.department === 'string'
        ? query.department
        : typeof query.filter === 'string'
          ? query.filter
          : undefined;

    const pageRaw = query.page;
    const limitRaw = query.limit;
    const pageStr = Array.isArray(pageRaw) ? pageRaw[0] : pageRaw;
    const limitStr = Array.isArray(limitRaw) ? limitRaw[0] : limitRaw;

    const currentPage = Math.max(1, Number(pageStr ?? 1));
    const limitPerPage = Math.max(1, Number(limitStr ?? 10));

    const offset = (currentPage - 1) * limitPerPage;

    const filterConditions = [];
    // If search exists, filter by subject name OR subject code
    if (search) {
    filterConditions.push(
        or(
            ilike(subjects.name, `%${search}%`),
            ilike(subjects.code, `%${search}%`)
        )
    )
}

    // If department filter exists, match department name
    if (department) {
    filterConditions.push(
      ilike(departments.name, `%${department}%`)
    );
}

    // Combine all filters using AND if any exist
    const whereClause =
      filterConditions.length > 0 ? and(...filterConditions) : undefined;

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(subjects)
      .leftJoin(departments, eq(subjects.departmentId, departments.id))
      .where(whereClause);

    const totalCount = countResult[0]?.count ?? 0;

    // Data query
    const subjectsList = await db
      .select({
        ...getTableColumns(subjects),
        department: {
          ...getTableColumns(departments),
        },
      })
      .from(subjects)
      .leftJoin(departments, eq(subjects.departmentId, departments.id))
      .where(whereClause)
      .orderBy(desc(subjects.createdAt))
      .limit(limitPerPage)
      .offset(offset);

    return res.status(200).json({
 data: subjectsList,
 pagination: {
      page: currentPage,
      limit: limitPerPage,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limitPerPage),
 },
});

}
catch (e) {
    console.error('GET /subjects error:', e);
    return res.status(500).json({ error: 'Failed to get subjects' });
}
})

export default router;
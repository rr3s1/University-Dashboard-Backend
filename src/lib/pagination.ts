/** Maximum allowed page size to avoid oversized DB queries. */
export const MAX_LIMIT = 100;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

function firstQueryValue(raw: unknown): unknown {
  return Array.isArray(raw) ? raw[0] : raw;
}

function parseStrictPositiveInt(v: unknown): number | null {
  if (typeof v === "number") {
    if (!Number.isFinite(v) || !Number.isInteger(v) || v < 1) return null;
    return v;
  }
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t === "") return null;
  if (!/^\d+$/.test(t)) return null;
  const n = parseInt(t, 10);
  if (n < 1) return null;
  return n;
}

export type PaginationParsed =
  | { ok: true; currentPage: number; limitPerPage: number; offset: number }
  | { ok: false; error: string };

/**
 * Validates `page` and `limit` query params: positive integers only, optional
 * defaults when omitted, and caps `limit` at {@link MAX_LIMIT}.
 */
export function parsePaginationQuery(
  pageRaw: unknown,
  limitRaw: unknown
): PaginationParsed {
  const pageVal = firstQueryValue(pageRaw);
  const limitVal = firstQueryValue(limitRaw);

  let currentPage: number;
  if (
    pageVal === undefined ||
    pageVal === null ||
    (typeof pageVal === "string" && pageVal.trim() === "")
  ) {
    currentPage = DEFAULT_PAGE;
  } else {
    const p = parseStrictPositiveInt(pageVal);
    if (p === null) {
      return {
        ok: false,
        error: "Invalid page: must be a positive integer",
      };
    }
    currentPage = p;
  }

  let limitPerPage: number;
  if (
    limitVal === undefined ||
    limitVal === null ||
    (typeof limitVal === "string" && limitVal.trim() === "")
  ) {
    limitPerPage = DEFAULT_LIMIT;
  } else {
    const l = parseStrictPositiveInt(limitVal);
    if (l === null) {
      return {
        ok: false,
        error: "Invalid limit: must be a positive integer",
      };
    }
    limitPerPage = Math.min(l, MAX_LIMIT);
  }

  return {
    ok: true,
    currentPage,
    limitPerPage,
    offset: (currentPage - 1) * limitPerPage,
  };
}

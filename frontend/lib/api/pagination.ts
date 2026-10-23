/**
 * DRF pagination helpers.
 *
 * Some list endpoints are paginated (PageNumberPagination) and return
 * { count, next, previous, results }. Others set pagination_class = None
 * and return a bare array. These helpers normalize both shapes so the
 * rest of the frontend has one contract to reason about.
 */

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

/**
 * Normalize a DRF list response to a Paginated<T>.
 *
 * If the response is already paginated, it is returned as-is.
 * If the response is a bare array (unpaginated view), it is wrapped
 * with a synthetic count and null next/previous so callers can use a
 * single shape.
 */
export function normalizePaginated<T>(data: Paginated<T> | T[]): Paginated<T> {
  if (Array.isArray(data)) {
    return {
      count: data.length,
      next: null,
      previous: null,
      results: data,
    };
  }
  return data;
}

/**
 * Normalize a DRF list response to a bare array.
 * Useful when a caller only needs the items and not the pagination
 * metadata (e.g. subjects, which are always a small list).
 */
export function normalizeList<T>(data: Paginated<T> | T[]): T[] {
  return Array.isArray(data) ? data : data.results;
}
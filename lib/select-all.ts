// Every row a query matches, not just the first thousand.
//
// Supabase (PostgREST) answers any select with at most 1000 rows and no error,
// so a list read in one go stops at 1000 without a word. The rep logs were read
// that way and the figures are counted from the rows, so "Emails sent" sat at
// exactly 1000 once the prospects board had logged more than that (2026-11-12).
//
// `build` returns a fresh query with its filters and its order already set; it
// is called once per page because a Supabase query cannot be awaited twice. An
// order on id is added after the caller's own, because rows logged together
// (a bulk "email sent" from the prospects board) share one timestamp, and
// paging over equal values without a tie-breaker can skip or repeat rows at a
// page boundary.

const PAGE = 1000

export async function selectAll(
  build: () => any,
  opts: { cap?: number } = {},
): Promise<{ data: any[]; error: any | null; truncated: boolean }> {
  const cap = opts.cap ?? 50000
  const rows: any[] = []
  for (let from = 0; from < cap; from += PAGE) {
    const { data, error } = await build().order('id', { ascending: true }).range(from, from + PAGE - 1)
    if (error) return { data: rows, error, truncated: false }
    rows.push(...(data || []))
    if ((data || []).length < PAGE) return { data: rows, error: null, truncated: false }
  }
  return { data: rows, error: null, truncated: true }
}

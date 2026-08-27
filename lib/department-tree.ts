// Walking a department tree.
//
// Pure, and imports nothing, so it can be compiled and tested on its own the
// way lib/calendar.ts is. Every walk here is cycle-safe with a visited set,
// not because the database allows a cycle - the trigger in migration 053
// rejects them - but because a walk that can loop forever is a request that
// never returns, and the cost of the guard is one Set.

export type DeptNode = {
  id: string
  organization_id: string
  name: string
  parent_id: string | null
  kind: 'company' | 'department'
  slug_segment: string | null
  brand?: Record<string, any> | null
  locked_fields?: string[] | null
}

export type TreeNode = DeptNode & { children: TreeNode[]; depth: number }

export function indexById(depts: DeptNode[]): Map<string, DeptNode> {
  return new Map(depts.map(d => [d.id, d]))
}

/**
 * Root-first chain from the top of the tree down to and including this
 * department. Root first because that is the order a brand cascade needs:
 * the group is applied first and each level below overrides it.
 */
export function ancestorChain(id: string, byId: Map<string, DeptNode>): DeptNode[] {
  const chain: DeptNode[] = []
  const seen = new Set<string>()
  let current: string | null = id

  while (current && !seen.has(current)) {
    seen.add(current)
    const node = byId.get(current)
    if (!node) break
    chain.push(node)
    current = node.parent_id
  }
  return chain.reverse()
}

/** This department and everything beneath it. */
export function subtreeIds(rootId: string, depts: DeptNode[]): Set<string> {
  const childrenOf = new Map<string, string[]>()
  for (const d of depts) {
    if (!d.parent_id) continue
    const list = childrenOf.get(d.parent_id) || []
    list.push(d.id)
    childrenOf.set(d.parent_id, list)
  }

  const out = new Set<string>()
  const stack = [rootId]
  while (stack.length) {
    const id = stack.pop()!
    if (out.has(id)) continue
    out.add(id)
    for (const child of childrenOf.get(id) || []) stack.push(child)
  }
  return out
}

/** Every id the given roots can reach, themselves included. */
export function subtreeIdsForMany(rootIds: Iterable<string>, depts: DeptNode[]): Set<string> {
  const all = new Set<string>()
  for (const id of rootIds) for (const found of subtreeIds(id, depts)) all.add(found)
  return all
}

/**
 * The company a department belongs to: itself if it is one, otherwise the
 * nearest ancestor that is. Null for a department in a flat organisation,
 * which is every organisation that has not opted in.
 */
export function companyOf(id: string, byId: Map<string, DeptNode>): DeptNode | null {
  const chain = ancestorChain(id, byId)
  for (let i = chain.length - 1; i >= 0; i--) {
    if (chain[i].kind === 'company') return chain[i]
  }
  return null
}

/** Nest a flat list. Orphans (a parent that is not in the list) become roots. */
export function buildTree(depts: DeptNode[]): TreeNode[] {
  const byId = new Map<string, TreeNode>(depts.map(d => [d.id, { ...d, children: [], depth: 0 }]))
  const roots: TreeNode[] = []

  for (const node of byId.values()) {
    const parent = node.parent_id ? byId.get(node.parent_id) : null
    if (parent && parent.id !== node.id) parent.children.push(node)
    else roots.push(node)
  }

  // Depth is assigned by walking down rather than counting parents, so a row
  // whose parent is missing still gets a sensible depth instead of NaN.
  const stack = roots.map(r => ({ node: r, depth: 0 }))
  const seen = new Set<string>()
  while (stack.length) {
    const { node, depth } = stack.pop()!
    if (seen.has(node.id)) continue
    seen.add(node.id)
    node.depth = depth
    for (const c of node.children) stack.push({ node: c, depth: depth + 1 })
  }

  const sortRec = (list: TreeNode[]) => {
    list.sort((a, b) => a.name.localeCompare(b.name))
    for (const n of list) sortRec(n.children)
  }
  sortRec(roots)
  return roots
}

/**
 * Brand for a card, cascading group then every level down to its own
 * department. Replaces the two-level merge in lib/team-brand for organisations
 * that have a hierarchy; a flat organisation produces exactly the same result
 * as before, because its chain is one department long.
 */
export function resolveBrandChain(
  orgBrand: Record<string, any> | null | undefined,
  chain: DeptNode[],
): Record<string, any> {
  let out: Record<string, any> = { ...(orgBrand || {}) }
  for (const node of chain) {
    if (node.brand && Object.keys(node.brand).length > 0) out = { ...out, ...node.brand }
  }
  return out
}

/**
 * Locked fields accumulate down the chain rather than overriding.
 *
 * A group that locks the logo must not have that lock removed by a company
 * that happens to lock only the colour: a child may add restrictions, never
 * lift one imposed above it.
 */
export function resolveLockedFields(chain: DeptNode[]): string[] {
  const locked = new Set<string>()
  for (const node of chain) for (const f of node.locked_fields || []) locked.add(f)
  return [...locked]
}

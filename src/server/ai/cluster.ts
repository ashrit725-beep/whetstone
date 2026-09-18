import './guard'
import { centroidOf, cosine, type Vector } from './text'

/**
 * Greedy agglomerative clustering, shared by the lexical and the embedding
 * paths.
 *
 * Items are visited in a fixed order and assigned to the first centroid they
 * clear the threshold against, or start a new cluster. That makes the result
 * deterministic for a given input, which matters more here than a marginally
 * better partition: a creator who reloads the dashboard must see the same
 * theme board, and an algorithm that reshuffles labels between renders destroys
 * trust in every one of them.
 *
 * Cost is O(n·k) for k clusters, which for the item counts a single project
 * produces is far below the point where anything smarter would pay for itself.
 */

export type VectorOps<V> = {
  centroid(vectors: readonly V[]): V
  similarity(a: V, b: V): number
}

export const sparseOps: VectorOps<Vector> = {
  centroid: (vectors) => centroidOf(vectors),
  similarity: (a, b) => cosine(a, b),
}

export const denseOps: VectorOps<readonly number[]> = {
  centroid: (vectors) => {
    const width = vectors[0]?.length ?? 0
    const sum = new Array<number>(width).fill(0)
    for (const v of vectors) {
      for (let i = 0; i < width; i++) sum[i] = (sum[i] ?? 0) + (v[i] ?? 0)
    }
    let norm = 0
    for (const value of sum) norm += value * value
    const len = Math.sqrt(norm)
    if (len === 0) return sum
    return sum.map((value) => value / len)
  },
  similarity: (a, b) => {
    const n = Math.min(a.length, b.length)
    let dot = 0
    for (let i = 0; i < n; i++) dot += (a[i] ?? 0) * (b[i] ?? 0)
    return dot
  },
}

export type Cluster<T, V> = {
  members: T[]
  vectors: V[]
  centroid: V
}

export function clusterGreedy<T, V>(
  entries: ReadonlyArray<{ item: T; vector: V }>,
  ops: VectorOps<V>,
  threshold: number,
): Array<Cluster<T, V>> {
  const clusters: Array<Cluster<T, V>> = []
  for (const entry of entries) {
    const best = nearest(clusters, entry.vector, ops, threshold)
    if (best) {
      best.members.push(entry.item)
      best.vectors.push(entry.vector)
      best.centroid = ops.centroid(best.vectors)
    } else {
      clusters.push({ members: [entry.item], vectors: [entry.vector], centroid: entry.vector })
    }
  }
  return rescueSingletons(mergeClusters(clusters, ops, threshold), ops, threshold)
}

function nearest<T, V>(
  clusters: ReadonlyArray<Cluster<T, V>>,
  vector: V,
  ops: VectorOps<V>,
  threshold: number,
): Cluster<T, V> | undefined {
  let best: Cluster<T, V> | undefined
  let bestScore = threshold
  for (const cluster of clusters) {
    const score = ops.similarity(vector, cluster.centroid)
    if (score >= bestScore) {
      bestScore = score
      best = cluster
    }
  }
  return best
}

/**
 * A single greedy pass is order-dependent in a way that hurts: the first item
 * seen becomes a centroid, and a later item that would have bridged two groups
 * arrives after both exist. Merging clusters whose centroids are themselves
 * close repairs that, and costs one pass over k centroids rather than a full
 * re-cluster.
 */
function mergeClusters<T, V>(
  clusters: Array<Cluster<T, V>>,
  ops: VectorOps<V>,
  threshold: number,
): Array<Cluster<T, V>> {
  let merged = true
  let guard = 0
  while (merged && guard < 8) {
    merged = false
    guard += 1
    outer: for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const a = clusters[i]
        const b = clusters[j]
        if (!a || !b) continue
        if (ops.similarity(a.centroid, b.centroid) < threshold) continue
        a.members.push(...b.members)
        a.vectors.push(...b.vectors)
        a.centroid = ops.centroid(a.vectors)
        clusters.splice(j, 1)
        merged = true
        break outer
      }
    }
  }
  return clusters
}

/**
 * An item that cleared no centroid on its own pass is measured again against the
 * finished centroids. A note that sits between two phrasings of one complaint
 * belongs with them, and on the first pass neither group existed yet.
 */
function rescueSingletons<T, V>(
  clusters: Array<Cluster<T, V>>,
  ops: VectorOps<V>,
  threshold: number,
): Array<Cluster<T, V>> {
  const groups = clusters.filter((cluster) => cluster.members.length > 1)
  if (groups.length === 0) return clusters
  const singles = clusters.filter((cluster) => cluster.members.length === 1)
  const kept: Array<Cluster<T, V>> = []
  for (const single of singles) {
    const vector = single.vectors[0]
    const member = single.members[0]
    if (vector === undefined || member === undefined) continue
    const home = nearest(groups, vector, ops, threshold)
    if (home) {
      home.members.push(member)
      home.vectors.push(vector)
      home.centroid = ops.centroid(home.vectors)
    } else {
      kept.push(single)
    }
  }
  return [...groups, ...kept]
}

/** The member closest to its centroid: the most representative of the group. */
export function representative<T, V>(cluster: Cluster<T, V>, ops: VectorOps<V>): T | undefined {
  let best: T | undefined
  let bestScore = -Infinity
  for (let i = 0; i < cluster.members.length; i++) {
    const member = cluster.members[i]
    const vector = cluster.vectors[i]
    if (member === undefined || vector === undefined) continue
    const score = ops.similarity(vector, cluster.centroid)
    if (score > bestScore) {
      bestScore = score
      best = member
    }
  }
  return best
}

/**
 * Union-Find over confirmed duplicate edges. Adding one item touches only its
 * own candidate edges, so a project never re-clusters from scratch.
 */
export class UnionFind {
  private readonly parent = new Map<string, string>()

  find(id: string): string {
    const seen: string[] = []
    let current = id
    for (;;) {
      const next = this.parent.get(current)
      if (next === undefined || next === current) break
      seen.push(current)
      current = next
    }
    for (const node of seen) this.parent.set(node, current)
    return current
  }

  union(a: string, b: string): void {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA === rootB) return
    // Lexicographically smaller id wins, so cluster ids are stable across runs.
    const [keep, drop] = rootA < rootB ? [rootA, rootB] : [rootB, rootA]
    this.parent.set(drop, keep)
    this.parent.set(keep, keep)
  }

  groups(ids: readonly string[]): Map<string, string[]> {
    const out = new Map<string, string[]>()
    for (const id of ids) {
      const root = this.find(id)
      const existing = out.get(root)
      if (existing) existing.push(id)
      else out.set(root, [id])
    }
    return out
  }
}

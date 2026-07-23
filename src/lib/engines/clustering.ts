import type { CorrCell } from './correlation';

export interface ClusterNode {
  name: string;
  children?: ClusterNode[];
  distance?: number;
}

function buildDistanceMatrix(
  corr: CorrCell[],
  assets: string[],
): Map<string, number> {
  const idx = new Map<string, number>();
  assets.forEach((a, i) => idx.set(a, i));
  const d: number[] = new Array(assets.length * assets.length).fill(1);
  for (let i = 0; i < assets.length; i++) d[i * assets.length + i] = 0;
  for (const c of corr) {
    const ia = idx.get(c.a);
    const ib = idx.get(c.b);
    if (ia === undefined || ib === undefined) continue;
    const dist = 1 - Math.abs(c.r);
    d[ia * assets.length + ib] = dist;
    d[ib * assets.length + ia] = dist;
  }
  const map = new Map<string, number>();
  for (let i = 0; i < assets.length; i++) {
    for (let j = 0; j < assets.length; j++) {
      map.set(`${i},${j}`, d[i * assets.length + j]);
    }
  }
  return map;
}

export function hierarchicalCluster(
  corr: CorrCell[],
  assets: string[],
): ClusterNode[] {
  if (assets.length === 0) return [];
  const dist = buildDistanceMatrix(corr, assets);
  type Cluster = { indices: number[]; node: ClusterNode };
  const clusters: Cluster[] = assets.map((a) => ({
    indices: [assets.indexOf(a)],
    node: { name: a },
  }));
  const indexMap = new Map<number, number>();
  clusters.forEach((c, i) => {
    c.indices.forEach((idx) => indexMap.set(idx, i));
  });

  while (clusters.length > 1) {
    let bestPair: [number, number] = [-1, -1];
    let bestDist = Infinity;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        let sum = 0;
        let count = 0;
        for (const ia of clusters[i].indices) {
          for (const ib of clusters[j].indices) {
            sum += dist.get(`${ia},${ib}`) ?? 1;
            count++;
          }
        }
        const avg = count === 0 ? 1 : sum / count;
        if (avg < bestDist) {
          bestDist = avg;
          bestPair = [i, j];
        }
      }
    }
    const [i, j] = bestPair;
    if (i < 0) break;
    const merged: Cluster = {
      indices: [...clusters[i].indices, ...clusters[j].indices],
      node: {
        name: `(${clusters[i].node.name}+${clusters[j].node.name})`,
        children: [clusters[i].node, clusters[j].node],
        distance: bestDist,
      },
    };
    clusters.splice(j, 1);
    clusters.splice(i, 1);
    clusters.push(merged);
  }
  return [clusters[0].node];
}

export function flatClusters(
  corr: CorrCell[],
  assets: string[],
  distanceThreshold: number,
): Record<string, number> {
  const dist = buildDistanceMatrix(corr, assets);
  const parent = new Array(assets.length).fill(0).map((_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  const edges: Array<{ i: number; j: number; d: number }> = [];
  for (let i = 0; i < assets.length; i++) {
    for (let j = i + 1; j < assets.length; j++) {
      edges.push({ i, j, d: dist.get(`${i},${j}`) ?? 1 });
    }
  }
  edges.sort((a, b) => a.d - b.d);
  for (const e of edges) {
    if (e.d <= distanceThreshold) union(e.i, e.j);
  }

  const rootToId = new Map<number, number>();
  const result: Record<string, number> = {};
  let nextId = 0;
  for (let i = 0; i < assets.length; i++) {
    const r = find(i);
    if (!rootToId.has(r)) {
      rootToId.set(r, nextId++);
    }
    result[assets[i]] = rootToId.get(r)!;
  }
  return result;
}

import { describe, it, expect } from 'vitest';
import {
  hierarchicalCluster,
  flatClusters,
} from '../../src/lib/engines/clustering';
import type { CorrCell } from '../../src/lib/engines/correlation';

interface Node {
  name: string;
  children?: Node[];
}

function countLeaves(node: Node): number {
  if (!node.children || node.children.length === 0) return 1;
  return node.children.reduce((s, c) => s + countLeaves(c), 0);
}

describe('flatClusters', () => {
  it('groups two highly-correlated assets together', () => {
    const cells: CorrCell[] = [
      { a: 'A', b: 'B', r: 0.9, window: '30d', n: 30 },
      { a: 'A', b: 'C', r: 0.1, window: '30d', n: 30 },
      { a: 'B', b: 'C', r: 0.1, window: '30d', n: 30 },
    ];
    const result = flatClusters(cells, ['A', 'B', 'C'], 0.4);
    expect(result['A']).toBe(result['B']);
    expect(result['A']).not.toBe(result['C']);
  });
});

describe('hierarchicalCluster', () => {
  it('returns tree with 3 leaves for 3 assets', () => {
    const cells: CorrCell[] = [
      { a: 'A', b: 'B', r: 0.9, window: '30d', n: 30 },
      { a: 'A', b: 'C', r: 0.1, window: '30d', n: 30 },
      { a: 'B', b: 'C', r: 0.1, window: '30d', n: 30 },
    ];
    const trees = hierarchicalCluster(cells, ['A', 'B', 'C']);
    expect(trees.length).toBe(1);
    expect(countLeaves(trees[0])).toBe(3);
  });
});

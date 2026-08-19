/**
 * Garde-fou anti-fabrication (incident 2026-08-19: moteur corrélations
 * fabriqué, commit 4c3124c). Math.random comme source de données interdit
 * dans lib backend, routes API et composants. Seuls les RNG statistiques
 * légitimes (bootstrap/permutation/Box-Muller) sont allowlistés.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', 'src');
const ALLOWLIST = new Set([
  'lib/statistical-validation.ts',
  'lib/quant/advanced-metrics.ts',
  'lib/funding-arbitrage/idea1-statistical-validation.ts',
]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\./.test(e)) out.push(p);
  }
  return out;
}

describe('anti-fabrication: Math.random comme source de données', () => {
  const files = walk(ROOT).map((p) => relative(ROOT, p));

  it('aucun fichier sous src/ n’utilise Math.random hors allowlist', () => {
    const offenders = files.filter((f) => {
      if (ALLOWLIST.has(f)) return false;
      return readFileSync(join(ROOT, f), 'utf8').includes('Math.random');
    });
    expect(offenders).toEqual([]);
  });

  it('l’allowlist ne référence que des fichiers existants', () => {
    const stale = [...ALLOWLIST].filter((f) => !files.includes(f));
    expect(stale).toEqual([]);
  });
});

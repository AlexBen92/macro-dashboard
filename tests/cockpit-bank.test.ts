import { describe, expect, it } from 'vitest';

import {
  bankHeadline,
  bankStatusColor,
  bankStatusText,
  effectiveBankStatus,
  formatBankMetrics,
  groupByFamily,
  retestNote,
} from '@/lib/cockpit/bank';
import type { BankStrategy, M15StrategiesBank } from '@/lib/cockpit/payloads';

function strat(overrides: Partial<BankStrategy> = {}): BankStrategy {
  return {
    id: 'x',
    family: 'A',
    name: 'strat x',
    registry_key: 'X',
    status_live: 'NULL',
    status_label: 'REJETÉ',
    status_doc: 'NULL',
    blocked: false,
    retest_policy: 'never_without_new_documented_mechanism',
    revisit: null,
    evidence: { path: null, date: null, verdict: null },
    metrics: {},
    engine: null,
    ...overrides,
  };
}

describe('bankStatusColor — non-VALIDATED jamais vert', () => {
  it('VALIDATED = vert', () => {
    expect(bankStatusColor('VALIDATED')).toBe('var(--bull)');
  });
  it('NULL/REJECTED = rouge, IN_VALIDATION = caution, UNTESTED/inconnu = dim', () => {
    expect(bankStatusColor('NULL')).toBe('var(--bear)');
    expect(bankStatusColor('REJECTED')).toBe('var(--bear)');
    expect(bankStatusColor('IN_VALIDATION')).toBe('var(--caution)');
    expect(bankStatusColor('UNTESTED')).toBe('var(--dim)');
    expect(bankStatusColor('NIMPORTE')).toBe('var(--dim)');
  });
});

describe('effectiveBankStatus — catalogue durcit, jamais verdit', () => {
  it('doc REJECTED sous clé registre générique UNTESTED → REJECTED', () => {
    const s = strat({ status_live: 'UNTESTED', status_doc: 'REJECTED' });
    expect(effectiveBankStatus(s)).toBe('REJECTED');
    expect(bankStatusText(s)).toBe('REJETÉ');
  });
  it('doc IN_VALIDATION sous live UNTESTED reste UNTESTED (jamais verdi)', () => {
    const s = strat({ status_live: 'UNTESTED', status_doc: 'IN_VALIDATION' });
    expect(effectiveBankStatus(s)).toBe('UNTESTED');
    expect(bankStatusColor(effectiveBankStatus(s))).toBe('var(--dim)');
  });
  it('VALIDATED live = VALIDATED même si doc pessimiste (registre prime en positif)', () => {
    const s = strat({ status_live: 'VALIDATED', status_doc: 'NULL' });
    expect(effectiveBankStatus(s)).toBe('VALIDATED');
  });
});

describe('bankStatusText', () => {
  it('bloqué affiche BLOQUÉ même si registre IN_VALIDATION', () => {
    const s = strat({ blocked: true, status_live: 'IN_VALIDATION', status_doc: 'BLOCKED_KEYS' });
    expect(bankStatusText(s)).toContain('BLOQUÉ');
  });
  it('NULL live → REJETÉ', () => {
    expect(bankStatusText(strat({ status_live: 'NULL', status_doc: 'NULL' }))).toBe('REJETÉ');
  });
});

describe('formatBankMetrics — rien inventé', () => {
  it('payload sans métriques → vide', () => {
    expect(formatBankMetrics(strat())).toEqual([]);
  });
  it('métriques présentes → formatées', () => {
    const s = strat({ metrics: { holdout_n_trades: 2, worst_fold_bps: -33.51, holdout_mean_bps: -31.5, n_configs: 8 } });
    const out = formatBankMetrics(s);
    expect(out).toContain('holdout n=2');
    expect(out.some((x) => x.includes('-33.5'))).toBe(true);
    expect(out).toContain('8 configs');
  });
});

describe('groupByFamily', () => {
  it('groupe et tri par famille, null → sans_famille', () => {
    const groups = groupByFamily([
      strat({ id: '1', family: 'B_orderflow' }),
      strat({ id: '2', family: 'A_trend' }),
      strat({ id: '3', family: null }),
      strat({ id: '4', family: 'B_orderflow' }),
    ]);
    expect(groups.map(([f]) => f)).toEqual(['A_trend', 'B_orderflow', 'sans_famille']);
    expect(groups[1][1]).toHaveLength(2);
  });
});

describe('retestNote', () => {
  it('NULL live ou doc REJECTED → jamais retester; blocked → revoir date; VALIDATED → null', () => {
    expect(retestNote(strat())).toContain('jamais retester');
    expect(retestNote(strat({ status_live: 'UNTESTED', status_doc: 'REJECTED' }))).toContain('jamais retester');
    expect(retestNote(strat({ status_live: 'VALIDATED', status_doc: 'VALIDATED' }))).toBeNull();
    expect(retestNote(strat({ blocked: true, status_live: 'IN_VALIDATION', status_doc: 'BLOCKED_KEYS', revisit: 'capture >= 90j' })))
      .toContain('capture >= 90j');
  });
});

describe('bankHeadline', () => {
  it('null → indisponible; sinon compteurs', () => {
    expect(bankHeadline(null)).toBe('banque indisponible');
    const bank: M15StrategiesBank = {
      spec_dir: '/x', n_strategies: 12, n_validated: 0,
      rule: 'r', strategies: [],
    };
    expect(bankHeadline(bank)).toBe('12 stratégies · 0 VALIDATED');
  });
});

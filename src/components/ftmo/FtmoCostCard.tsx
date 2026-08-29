'use client';

import { useMemo, useState } from 'react';

import { computeFtmoCost, getFtmoCosts, type FtmoSpec } from '@/lib/ftmo';

const INPUT_CLASS =
  'w-[56px] rounded-[2px] border border-[var(--border)] bg-[var(--bg3)] px-1.5 py-0.5 font-mono text-[0.6rem] text-[var(--text)] tabular-nums outline-none focus:border-[var(--purple)]';

function num(v: string, fallback: number): number {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export default function FtmoCostCard({ spec }: { spec: FtmoSpec }) {
  const [resets, setResets] = useState('1');
  const [volume, setVolume] = useState('150');
  const costs = useMemo(() => getFtmoCosts(), []);

  const res = useMemo(
    () =>
      computeFtmoCost({
        spec,
        resets: Math.round(num(resets, 1)),
        tradedVolume: num(volume, 150),
        costs,
      }),
    [spec, resets, volume, costs]
  );

  const rows: Array<[string, string, string]> = [
    [
      'Fees challenge (brut)',
      `${res.challengeFeesGross.toFixed(0)} ${spec.currency}`,
      `${(1 + Math.round(num(resets, 1)))} × ${spec.fee} (resets inclus)`,
    ],
    [
      'Fees nets si succès',
      `${res.challengeFeesNetIfSuccess.toFixed(0)} ${spec.currency}`,
      spec.feeRefundable ? 'premier fee remboursé au 1er payout' : 'one-step: non remboursable',
    ],
    [
      'Coûts de trading (commissions)',
      `${res.tradingCosts.toFixed(0)} USD`,
      `${volume} lots × ${costs.commissions.forex_lot_round} USD round-turn (indices: 0)`,
    ],
    [
      'Coût total attendu',
      `${res.expectedCost.toFixed(0)} ${spec.currency}`,
      'avant tout profit split',
    ],
    [
      'Break-even avant payout',
      `${res.breakEvenProfitBeforePayout.toFixed(0)} ${spec.currency}`,
      `profit brut minimum pour couvrir coûts au split ${(spec.profitSplitInitial * 100).toFixed(0)}%`,
    ],
  ];

  return (
    <section className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3 flex flex-col gap-2">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[0.65rem] text-[var(--purple)] uppercase tracking-[2px]">
          Coûts prop-firm · fees + friction
        </div>
        <div className="flex gap-1.5 font-mono text-[0.55rem] text-[var(--dim)]">
          <label className="flex items-center gap-1">
            <span className="uppercase tracking-[1px]">resets</span>
            <input className={INPUT_CLASS} value={resets} onChange={(e) => setResets(e.target.value)} />
          </label>
          <label className="flex items-center gap-1">
            <span className="uppercase tracking-[1px]">lots</span>
            <input className={INPUT_CLASS} value={volume} onChange={(e) => setVolume(e.target.value)} />
          </label>
        </div>
      </header>

      <table className="w-full font-mono text-[0.58rem]">
        <tbody>
          {rows.map(([label, value, note]) => (
            <tr key={label} className="border-b border-[var(--border)] last:border-0">
              <td className="py-1 pr-2 text-[var(--label)] uppercase tracking-[1px] align-top">{label}</td>
              <td className="py-1 pr-2 text-right text-[var(--text)] tabular-nums whitespace-nowrap align-top">
                {value}
              </td>
              <td className="py-1 text-[var(--muted)] leading-relaxed align-top">{note}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="font-mono text-[0.5rem] leading-relaxed text-[var(--muted)]">
        Spreads typiques: EURUSD {costs.spreads.EURUSD} pip · US500 {costs.spreads.US500} pt · US100{' '}
        {costs.spreads.US100} pt · BTC {costs.spreads.BTCUSD} USD. Swap US500 long{' '}
        {costs.symbols['US500.cash'].swap_long} USD/contrat/jour (triple vendredi).
      </div>
    </section>
  );
}

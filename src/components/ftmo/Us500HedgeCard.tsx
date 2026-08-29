'use client';

import { useMemo, useState } from 'react';

import { computeSpxHedge, computeUs500Exposure, getUs500Spec, type FtmoSpec } from '@/lib/ftmo';

const INPUT_CLASS =
  'w-[72px] rounded-[2px] border border-[var(--border)] bg-[var(--bg3)] px-1.5 py-0.5 font-mono text-[0.6rem] text-[var(--text)] tabular-nums outline-none focus:border-[var(--purple)]';

function num(v: string, fallback: number): number {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export default function Us500HedgeCard({ spec }: { spec: FtmoSpec }) {
  const [price, setPrice] = useState('6800');
  const [lots, setLots] = useState('2.0');
  const [spxLevel, setSpxLevel] = useState('6800');
  const [deltaTarget, setDeltaTarget] = useState('0.5');

  const us500 = useMemo(() => getUs500Spec(), []);
  const expo = useMemo(
    () => computeUs500Exposure({ price: num(price, 6800), lots: num(lots, 2), us500Spec: us500 }),
    [price, lots, us500]
  );

  // limites réalignées sur le compte sélectionné (référence config = 100k)
  const dailyLimit = spec.accountSize * spec.maxDailyLoss;
  const totalLimit = spec.accountSize * spec.maxTotalLoss;
  const marginStandard = expo.notional / us500.leverage_standard;
  const marginSwing = expo.notional / us500.leverage_swing;
  const dailyLossPoints = dailyLimit / (price ? num(price, 6800) * us500.contract_size : 1);

  const hedges = (['SPX', 'XSP', 'NANO'] as const).map((t) =>
    computeSpxHedge({
      notionalUs500: expo.notional,
      optionType: t,
      spxLevel: num(spxLevel, 6800),
      hedgeDeltaTarget: num(deltaTarget, 0.5),
    })
  );

  return (
    <section className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3 flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[0.65rem] text-[var(--purple)] uppercase tracking-[2px]">
          Bloc US500 + hedge options S&P mini (SPX / XSP / Nanos)
        </div>
        <div className="flex flex-wrap gap-1.5 font-mono text-[0.55rem] text-[var(--dim)]">
          <label className="flex items-center gap-1">
            <span className="uppercase tracking-[1px]">US500</span>
            <input className={INPUT_CLASS} value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          <label className="flex items-center gap-1">
            <span className="uppercase tracking-[1px]">lots</span>
            <input className={INPUT_CLASS} value={lots} onChange={(e) => setLots(e.target.value)} />
          </label>
          <label className="flex items-center gap-1">
            <span className="uppercase tracking-[1px]">SPX lvl</span>
            <input className={INPUT_CLASS} value={spxLevel} onChange={(e) => setSpxLevel(e.target.value)} />
          </label>
          <label className="flex items-center gap-1">
            <span className="uppercase tracking-[1px]">Δ target</span>
            <input className={INPUT_CLASS} value={deltaTarget} onChange={(e) => setDeltaTarget(e.target.value)} />
          </label>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 font-mono text-[0.55rem]">
        <div className="rounded-[2px] border border-[var(--border)] bg-[var(--bg3)] px-2 py-1.5">
          <div className="text-[var(--label)] uppercase tracking-[1.5px]">Notional US500</div>
          <div className="text-[var(--text)] tabular-nums">
            {expo.notional.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD
          </div>
        </div>
        <div className="rounded-[2px] border border-[var(--border)] bg-[var(--bg3)] px-2 py-1.5">
          <div className="text-[var(--label)] uppercase tracking-[1.5px]">Limite daily loss</div>
          <div className="text-[var(--bear)] tabular-nums">
            {dailyLimit.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD (≈{' '}
            {dailyLossPoints.toFixed(1)} pts)
          </div>
        </div>
        <div className="rounded-[2px] border border-[var(--border)] bg-[var(--bg3)] px-2 py-1.5">
          <div className="text-[var(--label)] uppercase tracking-[1.5px]">Limite total loss</div>
          <div className="text-[var(--bear)] tabular-nums">
            {totalLimit.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD
          </div>
        </div>
        <div className="rounded-[2px] border border-[var(--border)] bg-[var(--bg3)] px-2 py-1.5">
          <div className="text-[var(--label)] uppercase tracking-[1.5px]">Marge std / swing</div>
          <div className="text-[var(--text)] tabular-nums">
            {marginStandard.toLocaleString('en-US', { maximumFractionDigits: 0 })} /{' '}
            {marginSwing.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD
          </div>
        </div>
      </div>

      <table className="w-full font-mono text-[0.58rem]">
        <thead>
          <tr className="border-b border-[var(--border)] text-[var(--label)] uppercase tracking-[1px]">
            <th className="py-1 text-left">Hedge</th>
            <th className="py-1 text-right">Notional 1 contrat</th>
            <th className="py-1 text-right">Contrats pour Δ {deltaTarget}</th>
            <th className="py-1 text-left pl-3">Note</th>
          </tr>
        </thead>
        <tbody>
          {(['SPX', 'XSP', 'NANO'] as const).map((t, i) => (
            <tr key={t} className="border-b border-[var(--border)] last:border-0">
              <td className="py-1 text-[var(--purple)]">{t}</td>
              <td className="py-1 text-right text-[var(--text)] tabular-nums">
                {hedges[i].singleContractNotional.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD
              </td>
              <td className="py-1 text-right text-[var(--text)] tabular-nums">
                {hedges[i].contractsNeeded.toFixed(2)}
              </td>
              <td className="py-1 pl-3 text-[var(--muted)] leading-relaxed">
                {t === 'SPX' && '1 contrat ≈ 100 × SPX — hedge granularité grossière'}
                {t === 'XSP' && 'mini ≈ SPX/10 — granularité 10× meilleure'}
                {t === 'NANO' && 'nano ≈ SPX/100 — granularité optimale petit compte'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="font-mono text-[0.5rem] leading-relaxed text-[var(--muted)]">
        {us500.symbol} (alias {us500.alternative_symbol}) · contract size {us500.contract_size} · min{' '}
        {us500.min_volume} lot · heures {us500.trading_hours}. Swap long{' '}
        {us500.swap_model.swap_long} USD/jour, triple {us500.swap_model.triple_day}. Hedge = put
        OTM ou vertical debit selon Δ cible; data marché SPX pas branchée (interface prévue,
        config/ftmo/spx_options_specs.json).
      </div>
    </section>
  );
}

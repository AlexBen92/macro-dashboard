'use client';

import { useMemo, useState } from 'react';

import type { FtmoSpec, FtmoModel, FtmoAccountType } from '@/lib/ftmo';
import { computeRiskBudget } from '@/lib/ftmo-pricer/risk-budget';

interface GateResponse {
  gate: {
    verdict: 'GREEN' | 'ORANGE' | 'RED';
    canOpenNewTrade: boolean;
    reduceOnly: boolean;
    killNow: boolean;
    lossesToSoftStop: number;
    lossesToDailyFloor: number;
    floors: {
      daily: { floorUsd: number; distanceUsd: number; usagePct: number };
      total: { floorUsd: number; distanceUsd: number; usagePct: number };
      softDaily: { floorUsd: number; distanceUsd: number; usagePct: number; hit: boolean };
    };
  } | null;
  error?: string;
}

const MIN_RISK = 0.0025;
const MAX_RISK = 0.02;

function FloorLine({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div
      className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-[2px] border bg-[var(--bg3)] px-2.5 py-1.5 font-mono text-[0.6rem]"
      style={{ borderColor: color }}
    >
      <span className="text-[var(--label)] uppercase tracking-[1.5px]">{label}</span>
      <span className="flex items-baseline gap-2">
        <span style={{ color }}>{value}</span>
        {sub ? <span className="text-[0.5rem] text-[var(--dim)]">{sub}</span> : null}
      </span>
    </div>
  );
}

export default function FtmoFloorsCard({
  spec,
  accountKey,
  model,
  accountType,
  riskPerTrade,
  onRiskPerTradeChange,
}: {
  spec: FtmoSpec;
  accountKey?: string;
  model?: FtmoModel;
  accountType?: FtmoAccountType;
  riskPerTrade: number;
  onRiskPerTradeChange: (r: number) => void;
}) {
  const b = useMemo(() => computeRiskBudget(spec, riskPerTrade), [spec, riskPerTrade]);
  const [equityInput, setEquityInput] = useState('');
  const [dayStartInput, setDayStartInput] = useState('');
  const [peakInput, setPeakInput] = useState('');
  const [gate, setGate] = useState<GateResponse['gate']>(null);
  const [gateLoading, setGateLoading] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const fmtUsd = (v: number) =>
    `$${v.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}`;
  const pct = (v: number) => `${(v * 100).toFixed(v < 0.1 ? 2 : 1)}%`;
  const nLosses = (n: number) => (Number.isFinite(n) ? `${n}` : '—');

  const checkGate = async () => {
    const equity = Number(equityInput.replace(',', '.'));
    if (!Number.isFinite(equity) || equity <= 0) {
      setGateError('equity invalide');
      return;
    }
    setGateLoading(true);
    setGateError(null);
    try {
      const params = new URLSearchParams({
        account: accountKey ?? spec.accountKey,
        model: model ?? spec.model,
        type: accountType ?? spec.accountType,
        equity: String(equity),
        risk: String(riskPerTrade),
      });
      const ds = Number(dayStartInput.replace(',', '.'));
      if (Number.isFinite(ds) && ds > 0) params.set('dayStart', String(ds));
      const pk = Number(peakInput.replace(',', '.'));
      if (Number.isFinite(pk) && pk > 0) params.set('peak', String(pk));
      const res = await fetch(`/api/ftmo-risk?${params.toString()}`, { cache: 'no-store' });
      const json = (await res.json()) as GateResponse;
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setGate(json.gate);
    } catch (e) {
      setGate(null);
      setGateError((e as Error).message);
    } finally {
      setGateLoading(false);
    }
  };

  const verdictColor =
    gate?.verdict === 'GREEN' ? 'var(--green)' : gate?.verdict === 'RED' ? 'var(--red)' : 'var(--orange)';

  // barre segmentée: chaque segment = 1 perte au risk/trade courant
  const segs = useMemo(() => {
    if (!Number.isFinite(b.maxConsecLosses) || b.maxConsecLosses <= 0) return [];
    return Array.from({ length: b.maxConsecLosses }, (_, i) => {
      const lossNb = i + 1;
      const share = 1 / b.maxConsecLosses;
      const color =
        lossNb >= b.maxConsecLosses ? 'var(--red)' : lossNb >= b.lossesToSoftStop ? 'var(--orange)' : 'var(--green)';
      return { lossNb, share, color };
    });
  }, [b.maxConsecLosses, b.lossesToSoftStop]);

  return (
    <section className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3 flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[0.65rem] text-[var(--purple)] uppercase tracking-[2px]">
          Floors & budget de risque — valeurs en $
        </div>
        <div className="font-mono text-[0.5rem] text-[var(--dim)]">
          daily ancré balance 00:00 CE(S)T · floating inclus
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <FloorLine
          label="Floor daily (à balance initiale)"
          value={fmtUsd(b.dailyFloorUsd)}
          sub={`balance 00:00 − ${fmtUsd(b.dailyAllowanceUsd)} (${pct(spec.maxDailyLoss)})`}
          color="var(--red)"
        />
        <FloorLine
          label={`Floor max (${spec.maxLossMode === 'trailing_eod' ? 'trailing EOD, initial' : 'statique'})`}
          value={fmtUsd(b.totalFloorUsd)}
          sub={`initial − ${fmtUsd(b.totalAllowanceUsd)} (${pct(spec.maxTotalLoss)})`}
          color="var(--red)"
        />
        <FloorLine
          label={`Soft stop du jour (${(b.softStopShare * 100).toFixed(0)}%)`}
          value={fmtUsd(b.softDailyFloorUsd)}
          sub={`stop si perte jour ≥ ${fmtUsd(b.softDailyAllowanceUsd)}`}
          color="var(--orange)"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[1.5px]">
            Risk/trade
          </span>
          <input
            type="range"
            min={MIN_RISK}
            max={MAX_RISK}
            step={0.0005}
            value={riskPerTrade}
            onChange={(e) => onRiskPerTradeChange(Number(e.target.value))}
            className="flex-1 min-w-[160px] accent-[var(--purple)]"
            aria-label="Risk par trade en fraction du compte"
          />
          <span className="font-mono text-[0.65rem] text-[var(--purple)]">
            {pct(riskPerTrade)} · {fmtUsd(b.riskUsd)}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between font-mono text-[0.5rem] text-[var(--dim)]">
            <span>
              {nLosses(b.lossesToSoftStop)} perte(s) consécutive(s) = soft stop ({fmtUsd(b.softDailyAllowanceUsd)}) ·{' '}
              {nLosses(b.maxConsecLosses)} = collision daily (KO)
            </span>
            <span>{nLosses(b.maxConsecLosses)} segments = budget daily</span>
          </div>
          <div className="flex h-[10px] w-full gap-[1px] overflow-hidden rounded-[2px]">
            {segs.map((s) => (
              <div
                key={s.lossNb}
                className="h-full"
                style={{ width: `${s.share * 100}%`, background: s.color, opacity: 0.85 }}
                title={`perte #${s.lossNb}`}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 font-mono text-[0.55rem]">
          <div className="rounded-[2px] border border-[var(--border)] bg-[var(--bg3)] px-2 py-1.5">
            <div className="text-[var(--label)] uppercase tracking-[1px]">Risk/trade</div>
            <div className="text-[var(--text)]">
              {fmtUsd(b.riskUsd)} · {pct(riskPerTrade)} du compte
            </div>
          </div>
          <div className="rounded-[2px] border border-[var(--border)] bg-[var(--bg3)] px-2 py-1.5">
            <div className="text-[var(--label)] uppercase tracking-[1px]">Pertes avant KO daily</div>
            <div className="text-[var(--text)]">
              {nLosses(b.maxConsecLosses)} × {fmtUsd(b.riskUsd)} = {fmtUsd(b.dailyAllowanceUsd)}
            </div>
          </div>
          <div className="rounded-[2px] border border-[var(--orange)] bg-[var(--bg3)] px-2 py-1.5">
            <div className="text-[var(--label)] uppercase tracking-[1px]">Règle du jour</div>
            <div className="text-[var(--orange)]">
              perte cumulée ≥ {fmtUsd(b.softDailyAllowanceUsd)} → stop du jour
            </div>
          </div>
        </div>
      </div>

      {spec.maxLossMode === 'trailing_eod' ? (
        <div className="font-mono text-[0.45rem] text-[var(--dim)] leading-relaxed">
          1-step: le floor max TRAILING remonte à chaque nouveau plus haut de solde minuit (floor = max(initial,
          plus haut EOD) × {(1 - spec.maxTotalLoss).toFixed(2)}) et reset à {((1 - spec.maxTotalLoss) * 100).toFixed(0)}
          % du solde initial après chaque payout — le floor affiché est le niveau de départ.
        </div>
      ) : null}

      {/* Gate live via /api/ftmo-risk — même endpoint que les bots/agents */}
      <div className="flex flex-col gap-2 rounded-[3px] border border-[var(--border)] bg-[var(--bg3)] p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-mono text-[0.55rem] text-[var(--purple)] uppercase tracking-[2px]">
            Gate live — API /api/ftmo-risk (celle des bots)
          </div>
          <button
            onClick={checkGate}
            disabled={gateLoading}
            className="rounded-[2px] border border-[var(--border)] px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-[1px] text-[var(--dim)] hover:text-[var(--text)] disabled:opacity-50"
          >
            {gateLoading ? 'vérification…' : 'vérifier le gate'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 font-mono text-[0.55rem]">
          <label className="flex items-center gap-1">
            <span className="text-[var(--label)] uppercase tracking-[1px]">equity $</span>
            <input
              value={equityInput}
              onChange={(e) => setEquityInput(e.target.value)}
              placeholder={String(spec.accountSize)}
              inputMode="decimal"
              className="w-[90px] rounded-[2px] border border-[var(--border)] bg-[var(--bg)] px-1.5 py-0.5 text-[var(--text)]"
            />
          </label>
          <label className="flex items-center gap-1">
            <span className="text-[var(--label)] uppercase tracking-[1px]">balance 00:00 $</span>
            <input
              value={dayStartInput}
              onChange={(e) => setDayStartInput(e.target.value)}
              placeholder={String(spec.accountSize)}
              inputMode="decimal"
              className="w-[90px] rounded-[2px] border border-[var(--border)] bg-[var(--bg)] px-1.5 py-0.5 text-[var(--text)]"
            />
          </label>
          {spec.maxLossMode === 'trailing_eod' ? (
            <label className="flex items-center gap-1">
              <span className="text-[var(--label)] uppercase tracking-[1px]">peak EOD $</span>
              <input
                value={peakInput}
                onChange={(e) => setPeakInput(e.target.value)}
                placeholder={String(spec.accountSize)}
                inputMode="decimal"
                className="w-[90px] rounded-[2px] border border-[var(--border)] bg-[var(--bg)] px-1.5 py-0.5 text-[var(--text)]"
              />
            </label>
          ) : null}
        </div>

        {gateError ? (
          <div className="font-mono text-[0.55rem] text-[var(--red)]">Erreur: {gateError}</div>
        ) : null}

        {gate ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[0.6rem]">
              <span
                className="rounded-[2px] border px-2.5 py-0.5 tracking-[2px]"
                style={{ borderColor: verdictColor, color: verdictColor }}
              >
                {gate.verdict}
              </span>
              <span style={{ color: gate.killNow ? 'var(--red)' : 'var(--text)' }}>
                {gate.killNow ? 'KILL — couper tout' : gate.reduceOnly ? 'REDUCE ONLY — aucune nouvelle position' : gate.canOpenNewTrade ? 'Ouverture autorisée' : 'Attendre'}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5 font-mono text-[0.55rem]">
              <div className="rounded-[2px] border border-[var(--border)] px-2 py-1">
                <div className="text-[var(--label)] uppercase tracking-[1px]">Daily</div>
                <div className="text-[var(--text)]">
                  floor {fmtUsd(gate.floors.daily.floorUsd)} · marge {fmtUsd(gate.floors.daily.distanceUsd)} ·{' '}
                  {(gate.floors.daily.usagePct * 100).toFixed(1)}% utilisé
                </div>
              </div>
              <div className="rounded-[2px] border border-[var(--border)] px-2 py-1">
                <div className="text-[var(--label)] uppercase tracking-[1px]">Max loss</div>
                <div className="text-[var(--text)]">
                  floor {fmtUsd(gate.floors.total.floorUsd)} · marge {fmtUsd(gate.floors.total.distanceUsd)} ·{' '}
                  {(gate.floors.total.usagePct * 100).toFixed(1)}% utilisé
                </div>
              </div>
              <div className="rounded-[2px] border border-[var(--border)] px-2 py-1">
                <div className="text-[var(--label)] uppercase tracking-[1px]">Soft stop 75%</div>
                <div style={{ color: gate.floors.softDaily.hit ? 'var(--orange)' : 'var(--text)' }}>
                  {gate.floors.softDaily.hit ? 'TOUCHÉ' : `marge ${fmtUsd(gate.floors.softDaily.distanceUsd)}`} ·{' '}
                  {gate.lossesToSoftStop} pertes restantes avant stop
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="font-mono text-[0.45rem] text-[var(--dim)]">
            Saisir l'equity live (floating inclus) et la balance à 00:00 CE(S)T — le gate interroge la même API que
            tes agents: killNow → couper tout, reduceOnly → aucune nouvelle position.
          </div>
        )}
      </div>
    </section>
  );
}

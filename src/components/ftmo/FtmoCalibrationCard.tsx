'use client';

import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import type { FtmoCalibPayload } from '@/lib/ftmo';

function Param({ label, value, ok }: { label: string; value: string; ok?: boolean | null }) {
  return (
    <div className="flex items-baseline justify-between gap-2 font-mono text-[0.55rem]">
      <span className="text-[var(--label)] uppercase tracking-[1px]">{label}</span>
      <span className={ok === undefined || ok === null ? 'text-[var(--text)]' : ok ? 'text-[var(--green)]' : 'text-[var(--red)]'}>
        {value}
      </span>
    </div>
  );
}

export default function FtmoCalibrationCard({ calib, loading }: { calib: FtmoCalibPayload | null; loading?: boolean }) {
  const densityData = useMemo(() => {
    if (!calib)
      return {
        horizons: [] as { T: number; days: number }[],
        rows: [] as unknown[],
        series: [] as { days: number; points: { k: number; pdf: number }[] }[],
      };
    const hs = calib.densities.map((d) => ({ T: d.T, days: d.days }));
    // une série par horizon, x = k (log-moneyness), y = pdf
    const series = calib.densities.map((d) => ({
      days: d.days,
      points: d.points.map((p) => ({ k: +p.k.toFixed(3), pdf: +p.pdf.toFixed(4) })),
    }));
    return { horizons: hs, series };
  }, [calib]);

  if (!calib) {
    return (
      <section className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3 font-mono text-[0.55rem] text-[var(--dim)]">
        {loading ? 'chargement calibration SPX (CBOE)…' : 'Calibration indisponible (chaîne SPX CBOE non collectée)'}
      </section>
    );
  }
  const b = calib.bates;
  const s = calib.ssvi;
  const colors = ['var(--purple)', 'var(--green)', 'var(--orange)', 'var(--red)', 'var(--blue)'];
  return (
    <section className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3 flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[0.65rem] text-[var(--purple)] uppercase tracking-[2px]">
          Calibration risque-neutre · SPX (CBOE) → SSVI → Bates
        </div>
        <div className="font-mono text-[0.5rem] text-[var(--dim)] uppercase tracking-[1px]">
          {calib.symbol} {calib.spot.toFixed(0)} · iv30 {(calib.iv30 * 100).toFixed(1)}% · {calib.nOptionsRaw.toLocaleString('fr-FR')} options · {calib.asOf.slice(0, 16)}Z
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[1.5px]">Bates (SVJ)</div>
          <Param label="κ (retour var)" value={b.params.kappa.toFixed(2)} />
          <Param label="θ (var LT)" value={b.params.theta.toFixed(4)} />
          <Param label="σv (vol-of-vol)" value={b.params.sigmaV.toFixed(3)} />
          <Param label="ρ (corr)" value={b.params.rho.toFixed(3)} />
          <Param label="V0 (var init)" value={b.params.V0.toFixed(4)} />
          <Param label="λj (intensité sauts)" value={b.params.lambdaJ.toFixed(3)} />
          <Param label="νj (moy. saut)" value={b.params.nuJ.toFixed(3)} />
          <Param label="δj (vol saut)" value={b.params.deltaJ.toFixed(3)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[1.5px]">Qualité de fit</div>
          <Param label="RMSE IV SSVI" value={`${(s.rmseIv * 100).toFixed(2)} pts`} ok={s.rmseIv < 0.03} />
          <Param label="RMSE IV Bates" value={`${(b.rmseIv * 100).toFixed(2)} pts`} ok={b.rmseIv < 0.04} />
          <Param label="Feller (2κθ>σv²)" value={b.fellerRatio.toFixed(2)} ok={b.fellerOk} />
          <Param label="SSVI ρ / η / γ" value={`${s.params.rho.toFixed(2)} / ${s.params.eta.toFixed(2)} / ${s.params.gamma.toFixed(2)}`} />
          <Param label="Sans arbitrage butterfly" value={s.butterflyOk ? 'OK' : 'VIOLÉ'} ok={s.butterflyOk} />
          <Param label="Sans arbitrage calendaire" value={s.calendarOk ? 'OK' : 'VIOLÉ'} ok={s.calendarOk} />
          <Param label="Slices calibrées" value={`${calib.nSlices}`} />
          <Param label="Drift forward Q" value={`${(calib.fwdDriftAnn * 100).toFixed(2)}%/an`} />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[1.5px]">Term structure IV ATM</div>
          <div className="flex-1 min-h-[120px]">
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={calib.slices.map((sl) => ({ d: sl.expiryDays, iv: +(sl.atmIv * 100).toFixed(2) }))}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 2" />
                <XAxis dataKey="d" tick={{ fontSize: 8, fill: 'var(--dim)' }} stroke="var(--border)" />
                <YAxis tick={{ fontSize: 8, fill: 'var(--dim)' }} stroke="var(--border)" domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ fontSize: 9, background: 'var(--bg)', border: '1px solid var(--border)' }} />
                <Line type="monotone" dataKey="iv" stroke="var(--purple)" dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[1.5px]">
          Densité risque-neutre par horizon (pdf de k = ln(S_T/F), mesure Q — pas une prédiction réelle)
        </div>
        <div className="h-[170px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 2" />
              <XAxis dataKey="k" type="number" domain={[-0.5, 0.5]} tick={{ fontSize: 8, fill: 'var(--dim)' }} stroke="var(--border)" />
              <YAxis tick={{ fontSize: 8, fill: 'var(--dim)' }} stroke="var(--border)" />
              <Tooltip contentStyle={{ fontSize: 9, background: 'var(--bg)', border: '1px solid var(--border)' }} />
              <ReferenceLine x={0} stroke="var(--dim)" strokeDasharray="3 3" />
              {densityData.series.map((ser, i) => (
                <Line key={ser.days} data={ser.points} type="monotone" dataKey="pdf" name={`${ser.days}j`} stroke={colors[i % colors.length]} dot={false} strokeWidth={1.2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

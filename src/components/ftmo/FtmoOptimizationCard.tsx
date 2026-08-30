'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';

export interface SurfacePoint {
  lambdaEval: number;
  lambdaFunded: number;
  edge: number;
}

export default function FtmoOptimizationCard({
  curve,
  lambdaStar,
  objectiveLabel,
  surface,
  surfaceLoading,
  onRunSurface,
}: {
  curve: { lambda: number; value: number }[];
  lambdaStar: number;
  objectiveLabel: string;
  surface: SurfacePoint[] | null;
  surfaceLoading: boolean;
  onRunSurface: () => void;
}) {
  const data = curve.map((c) => ({ l: c.lambda, v: +c.value.toFixed(2) }));
  const lfs = surface ? [...new Set(surface.map((p) => p.lambdaFunded))].sort((a, b) => a - b) : [];
  const les = surface ? [...new Set(surface.map((p) => p.lambdaEval))].sort((a, b) => a - b) : [];
  const maxAbs = surface ? Math.max(...surface.map((p) => Math.abs(p.edge))) || 1 : 1;
  const best = surface ? surface.reduce((a, b) => (b.edge > a.edge ? b : a)) : null;

  const cellColor = (edge: number): string => {
    if (edge >= 0) {
      const t = Math.min(1, edge / maxAbs);
      return `rgba(80, 220, 140, ${0.12 + 0.55 * t})`;
    }
    const t = Math.min(1, -edge / maxAbs);
    return `rgba(235, 90, 90, ${0.12 + 0.5 * t})`;
  };

  return (
    <section className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3 flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[0.65rem] text-[var(--purple)] uppercase tracking-[2px]">
          Optimisation du levier par phase
        </div>
        <div className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[1px]">
          λ* = {lambdaStar.toFixed(2)} · objectif: {objectiveLabel}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <div className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[1.5px]">
            Courbe objectif × λ_éval (structure en U: trop peu ET trop de levier sous-optimaux)
          </div>
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 2" />
                <XAxis dataKey="l" tick={{ fontSize: 8, fill: 'var(--dim)' }} stroke="var(--border)" />
                <YAxis tick={{ fontSize: 8, fill: 'var(--dim)' }} stroke="var(--border)" />
                <Tooltip contentStyle={{ fontSize: 9, background: 'var(--bg)', border: '1px solid var(--border)' }} />
                <ReferenceLine x={lambdaStar} stroke="var(--green)" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="v" stroke="var(--purple)" dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[1.5px]">
              Surface edge net × (λ_éval, λ_funded)
            </div>
            <button
              onClick={onRunSurface}
              disabled={surfaceLoading}
              className="rounded-[2px] border border-[var(--border)] px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-[1px] text-[var(--dim)] hover:text-[var(--text)] disabled:opacity-50"
            >
              {surfaceLoading ? 'calcul…' : 'calculer surface'}
            </button>
          </div>
          {surface && lfs.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              <div className="font-mono text-[0.5rem] text-[var(--dim)]">
                optimum: λ_éval {best?.lambdaEval.toFixed(1)} / λ_funded {best?.lambdaFunded.toFixed(1)} → edge{' '}
                {best ? `$${best.edge.toFixed(0)}` : '-'}
              </div>
              <div className="grid gap-[1px]" style={{ gridTemplateColumns: `28px repeat(${les.length}, 1fr)` }}>
                <div />
                {les.map((le) => (
                  <div key={le} className="text-center font-mono text-[0.4rem] text-[var(--dim)]">
                    {le.toFixed(0)}
                  </div>
                ))}
                {lfs.map((lf) => (
                  <div key={lf} className="contents">
                    <div className="flex items-center justify-end pr-1 font-mono text-[0.4rem] text-[var(--dim)]">
                      {lf.toFixed(0)}
                    </div>
                    {les.map((le) => {
                      const pt = surface.find((p) => p.lambdaEval === le && p.lambdaFunded === lf)!;
                      return (
                        <div
                          key={`${le}-${lf}`}
                          title={`λ_éval ${le} / λ_funded ${lf} → $${pt.edge.toFixed(0)}`}
                          className="h-[14px] rounded-[1px]"
                          style={{ background: cellColor(pt.edge) }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="font-mono text-[0.4rem] text-[var(--dim)]">
                lignes = λ_funded · colonnes = λ_éval · vert = edge positif
              </div>
            </div>
          ) : (
            <div className="h-[160px] flex items-center justify-center font-mono text-[0.5rem] text-[var(--dim)]">
              {surfaceLoading ? 'simulation Monte Carlo en cours…' : 'cliquer pour lancer la grille'}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

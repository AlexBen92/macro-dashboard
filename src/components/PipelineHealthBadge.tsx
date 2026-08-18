'use client';

import { useEffect, useState } from 'react';

/**
 * Badge santé pipeline global — worst-of des 5 sources /api/agent/state
 * (regime, m15, decision, orderflow, funding). OK = tout ok+frais,
 * DÉGRADÉ = ≥1 source stale/erreur, HS = route injoignable.
 */

type Health = 'ok' | 'degraded' | 'down' | 'loading';

interface SourceStatus {
  ok: boolean;
  stale: boolean;
}

export default function PipelineHealthBadge() {
  const [health, setHealth] = useState<Health>('loading');
  const [nDown, setNDown] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/agent/state');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = (await res.json()) as { sources?: Record<string, SourceStatus> };
        if (cancelled) return;
        const srcs = Object.values(d.sources ?? {});
        const bad = srcs.filter((s) => !s.ok || s.stale).length;
        setNDown(bad);
        setHealth(bad === 0 ? 'ok' : 'degraded');
      } catch {
        if (!cancelled) setHealth('down');
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const conf = {
    ok: { label: 'DATA OK', color: '#4ade80' },
    degraded: { label: `DÉGRADÉ${nDown ? ` ${nDown}/5` : ''}`, color: '#f59e0b' },
    down: { label: 'DATA HS', color: '#ef4444' },
    loading: { label: 'DATA ···', color: '#556680' },
  }[health];

  return (
    <span
      className="flex items-center gap-1.5 font-mono text-[0.55rem] uppercase tracking-[1px] whitespace-nowrap ml-auto pr-1"
      title="Santé pipeline: pire des 5 sources /api/agent/state (régime, m15, décision, orderflow, funding)"
    >
      <span
        className="w-1.5 h-1.5 rounded-full inline-block"
        style={{ background: conf.color, boxShadow: `0 0 4px ${conf.color}` }}
      />
      <span style={{ color: conf.color }}>{conf.label}</span>
    </span>
  );
}

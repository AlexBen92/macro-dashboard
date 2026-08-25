'use client';

import { useCockpitState } from '@/hooks/api/useCockpitState';

/**
 * Bloc 7 — Skills de l'agent & progression: distinction carry/directionnel,
 * clause « 0 trade = résultat correct », transitions de régime, discipline
 * shadow. Tests + commits récents.
 */
export default function AgentSkillsDashboard() {
  const { data, isLoading, error } = useCockpitState();
  const s = data?.skills ?? null;
  const sk = s?.skills ?? null;

  const compliance = sk?.carry_vs_directionnel?.compliance_rate ?? null;
  const churn = sk?.shadow_discipline?.churn_events_7d ?? null;
  const zeroDays = sk?.zero_trade_discipline?.days_zero_trade_30d ?? null;

  return (
    <div className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3" data-testid="skills-dashboard">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[0.55rem] uppercase tracking-[3px] text-[var(--label)]">
          AGENT SKILLS & PROGRESSION
        </span>
        <span className="font-mono text-[0.45rem] text-[var(--dim)]">cycle */15 · shadow</span>
      </div>
      {isLoading && <div className="font-mono text-[0.55rem] text-[var(--muted)]">chargement…</div>}
      {error && <div className="font-mono text-[0.55rem] text-[var(--caution)]">indisponible</div>}
      {sk && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Skill
            title="1 · Carry vs directionnel"
            value={compliance !== null ? `${(compliance * 100).toFixed(0)}% conformes` : '—'}
            detail={
              sk.carry_vs_directionnel
                ? `${sk.carry_vs_directionnel.n_carry_enter_14d} ENTER carry 14j · ${sk.carry_vs_directionnel.n_one_leg_violations} violations une-jambe`
                : ''
            }
            status={compliance === null ? 'unknown' : compliance >= 0.95 ? 'good' : compliance >= 0.8 ? 'ok' : 'bad'}
          />
          <Skill
            title="2 · Clause 0 trade = correct"
            value={zeroDays !== null ? `${zeroDays}j sans trade / 30j` : '—'}
            detail={
              sk.zero_trade_discipline
                ? `${sk.zero_trade_discipline.days_with_trades_30d}j avec trades · ${
                    sk.zero_trade_discipline.today_edge === 0
                      ? "aujourd'hui: 0 trade & NO_EDGE ✓"
                      : sk.zero_trade_discipline.today_edge === 1
                        ? "aujourd'hui: trades malgré NO_EDGE ✗"
                        : "aujourd'hui: edge présent"
                  }`
                : ''
            }
            status="info"
          />
          <Skill
            title="3 · Transitions de régime"
            value={
              sk.regime_transitions
                ? `${sk.regime_transitions.n_transitions} transitions observées`
                : '—'
            }
            detail={
              sk.regime_transitions?.last
                ? `dernière: ${sk.regime_transitions.last.from}→${sk.regime_transitions.last.to} le ${sk.regime_transitions.last.ts.slice(0, 10)} · ${sk.regime_transitions.enter_within_24h_of_transition} ENTER dans les 24h`
                : 'aucune transition dans l’historique shadow'
            }
            status="info"
          />
          <Skill
            title="4 · Discipline shadow"
            value={churn !== null ? `${churn} churn 7j` : '—'}
            detail={
              sk.shadow_discipline
                ? Object.entries(sk.shadow_discipline.actions_7d)
                    .map(([a, n]) => `${a}:${n}`)
                    .join(' · ') || 'aucune action 7j'
                : ''
            }
            status={churn === null ? 'unknown' : churn <= 1 ? 'good' : churn <= 3 ? 'ok' : 'bad'}
          />
        </div>
      )}
      {s && (
        <div className="mt-2 flex flex-col gap-1 font-mono text-[0.42rem] text-[var(--dim)]">
          <div className="flex flex-wrap gap-x-4">
            <span>
              tests:{' '}
              {Object.entries(s.tests)
                .filter(([, n]) => n !== null)
                .map(([k, n]) => `${k.split('_')[0]}=${n}`)
                .join(' · ')}
            </span>
          </div>
          {Object.entries(s.commits)
            .filter(([, list]) => list.length > 0)
            .map(([repo, list]) => (
              <div key={repo} className="truncate" title={list.join('\n')}>
                {repo}: {list[0]}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function Skill({
  title,
  value,
  detail,
  status,
}: {
  title: string;
  value: string;
  detail: string;
  status: 'good' | 'ok' | 'bad' | 'info' | 'unknown';
}) {
  const color =
    status === 'good'
      ? 'var(--bull)'
      : status === 'ok'
        ? 'var(--caution)'
        : status === 'bad'
          ? 'var(--bear)'
          : 'var(--muted)';
  return (
    <div className="rounded-[3px] border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5">
      <div className="flex items-center justify-between font-mono text-[0.5rem]">
        <span className="text-[var(--label)] uppercase tracking-[1px]">{title}</span>
        <span className="font-bold" style={{ color }}>
          {value}
        </span>
      </div>
      <div className="mt-0.5 font-mono text-[0.42rem] text-[var(--dim)] leading-relaxed">{detail}</div>
    </div>
  );
}

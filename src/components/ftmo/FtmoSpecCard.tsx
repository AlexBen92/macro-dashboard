'use client';

import type { FtmoSpec, FtmoModel, FtmoAccountType } from '@/lib/ftmo';
import { FTMO_ACCOUNT_KEYS } from '@/lib/ftmo';

const MODEL_LABEL: Record<FtmoModel, string> = {
  two_step: 'Two-step (Challenge + Verification)',
  one_step: 'One-step (Evaluation)',
};

function RuleBar({
  label,
  pct,
  valueLabel,
  color,
}: {
  label: string;
  pct: number;
  valueLabel: string;
  color: string;
}) {
  const clamped = Math.min(100, Math.max(0, pct * 100));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between font-mono text-[0.55rem]">
        <span className="text-[var(--label)] uppercase tracking-[1.5px]">{label}</span>
        <span className="text-[var(--text)]">{valueLabel}</span>
      </div>
      <div className="h-[3px] w-full bg-[var(--border)] rounded-[2px] overflow-hidden">
        <div className="h-full rounded-[2px]" style={{ width: `${clamped}%`, background: color }} />
      </div>
    </div>
  );
}

export default function FtmoSpecCard({
  spec,
  accountKey,
  model,
  accountType,
  onAccountChange,
  onModelChange,
  onAccountTypeChange,
}: {
  spec: FtmoSpec;
  accountKey: string;
  model: FtmoModel;
  accountType: FtmoAccountType;
  onAccountChange: (k: string) => void;
  onModelChange: (m: FtmoModel) => void;
  onAccountTypeChange: (t: FtmoAccountType) => void;
}) {
  const fmtEur = (v: number) =>
    `${v.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} ${spec.currency}`;
  const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

  return (
    <section className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3 flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[0.65rem] text-[var(--purple)] uppercase tracking-[2px]">
          FTMO · Règles du compte
        </div>
        <div className="flex flex-wrap gap-1">
          {FTMO_ACCOUNT_KEYS.map((k) => (
            <button
              key={k}
              onClick={() => onAccountChange(k)}
              className={`rounded-[2px] border px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-[1px] transition-colors ${
                k === accountKey
                  ? 'border-[var(--purple)] text-[var(--purple)] bg-[var(--purple)]/10'
                  : 'border-[var(--border)] text-[var(--dim)] hover:text-[var(--text)]'
              }`}
            >
              {k}
            </button>
          ))}
          {(['two_step', 'one_step'] as FtmoModel[]).map((m) => (
            <button
              key={m}
              onClick={() => onModelChange(m)}
              className={`rounded-[2px] border px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-[1px] transition-colors ${
                m === model
                  ? 'border-[var(--purple)] text-[var(--purple)] bg-[var(--purple)]/10'
                  : 'border-[var(--border)] text-[var(--dim)] hover:text-[var(--text)]'
              }`}
            >
              {m === 'two_step' ? '2-STEP' : '1-STEP'}
            </button>
          ))}
          {(['standard', 'swing'] as FtmoAccountType[]).map((t) => (
            <button
              key={t}
              onClick={() => onAccountTypeChange(t)}
              className={`rounded-[2px] border px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-[1px] transition-colors ${
                t === accountType
                  ? 'border-[var(--purple)] text-[var(--purple)] bg-[var(--purple)]/10'
                  : 'border-[var(--border)] text-[var(--dim)] hover:text-[var(--text)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
        <RuleBar
          label="Profit target P1"
          pct={spec.profitTargetPhase1}
          valueLabel={fmtPct(spec.profitTargetPhase1)}
          color="var(--purple)"
        />
        {spec.model === 'two_step' && (
          <RuleBar
            label="Profit target P2"
            pct={spec.profitTargetPhase2}
            valueLabel={fmtPct(spec.profitTargetPhase2)}
            color="var(--purple)"
          />
        )}
        <RuleBar
          label="Max daily loss"
          pct={spec.maxDailyLoss}
          valueLabel={`${fmtPct(spec.maxDailyLoss)} · ${fmtEur(spec.accountSize * spec.maxDailyLoss)}`}
          color="var(--bear)"
        />
        <RuleBar
          label="Max total loss"
          pct={spec.maxTotalLoss}
          valueLabel={`${fmtPct(spec.maxTotalLoss)} · ${fmtEur(spec.accountSize * spec.maxTotalLoss)}`}
          color="var(--bear)"
        />
        <RuleBar
          label="Profit split initial → max"
          pct={spec.profitSplitMax}
          valueLabel={`${fmtPct(spec.profitSplitInitial)} → ${fmtPct(spec.profitSplitMax)}`}
          color="var(--bull)"
        />
        <RuleBar
          label={`Fee challenge (${MODEL_LABEL[spec.model].split(' ')[0]})`}
          pct={spec.fee / spec.accountSize}
          valueLabel={`${fmtEur(spec.fee)}${spec.feeRefundable ? ' · remboursable' : ' · non-remboursable'}`}
          color="var(--caution)"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 font-mono text-[0.55rem] leading-relaxed">
        <div className="rounded-[2px] border border-[var(--border)] bg-[var(--bg3)] px-2 py-1.5">
          <div className="text-[var(--label)] uppercase tracking-[1.5px]">Leviers</div>
          <div className="text-[var(--text)]">
            forex {spec.leverageByAsset.forex}:1 · indices {spec.leverageByAsset.indices}:1 · crypto{' '}
            {spec.leverageByAsset.crypto}:1
          </div>
        </div>
        <div className="rounded-[2px] border border-[var(--border)] bg-[var(--bg3)] px-2 py-1.5">
          <div className="text-[var(--label)] uppercase tracking-[1.5px]">Contraintes</div>
          <div className="text-[var(--text)]">
            min {spec.minTradingDaysPhase} jours/trading par phase · phases: {spec.phases.join(' → ')}
          </div>
        </div>
        <div className="rounded-[2px] border border-[var(--border)] bg-[var(--bg3)] px-2 py-1.5">
          <div className="text-[var(--label)] uppercase tracking-[1.5px]">News ({spec.accountType})</div>
          <div className="text-[var(--text)]">{spec.newsRestrictions}</div>
        </div>
      </div>
    </section>
  );
}

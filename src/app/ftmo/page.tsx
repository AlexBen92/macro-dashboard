'use client';

import { useState } from 'react';

import FtmoSpecCard from '@/components/ftmo/FtmoSpecCard';
import FtmoRiskPanel from '@/components/ftmo/FtmoRiskPanel';
import FtmoCostCard from '@/components/ftmo/FtmoCostCard';
import Us500HedgeCard from '@/components/ftmo/Us500HedgeCard';

import {
  getFtmoSpec,
  type AccountKey,
  type FtmoModel,
  type FtmoAccountType,
} from '@/lib/ftmo';

function TierLabel({ children }: { children: string }) {
  return (
    <div className="font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[3px]">
      {children}
    </div>
  );
}

export default function FtmoPage() {
  const [accountKey, setAccountKey] = useState<AccountKey>('100k');
  const [model, setModel] = useState<FtmoModel>('two_step');
  const [accountType, setAccountType] = useState<FtmoAccountType>('standard');

  const sizeMap: Record<AccountKey, number> = {
    '10k': 10000,
    '25k': 25000,
    '50k': 50000,
    '100k': 100000,
    '200k': 200000,
  };
  const spec = getFtmoSpec(sizeMap[accountKey], model, accountType);

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 px-4 py-3 flex flex-col gap-6">
        {/* TIER 1 — bloc de règles: FTMO = contraintes, pas juste un compte */}
        <section className="flex flex-col gap-3">
          <TierLabel>
            Tier 1 · Bloc de règles FTMO — contrats · limites · leviers · news
          </TierLabel>
          <FtmoSpecCard
            spec={spec}
            accountKey={accountKey}
            model={model}
            accountType={accountType}
            onAccountChange={(k) => setAccountKey(k as AccountKey)}
            onModelChange={setModel}
            onAccountTypeChange={setAccountType}
          />
        </section>

        {/* TIER 2 — risque & coûts */}
        <section className="flex flex-col gap-3">
          <TierLabel>
            Tier 2 · Risque & coûts — daily loss / max DD / near-breach / fees / friction
          </TierLabel>
          <FtmoRiskPanel spec={spec} />
          <FtmoCostCard spec={spec} />
        </section>

        {/* Séparateur T2/T3 — risk shaping vs exécution hedge */}
        <div className="rounded-[3px] border border-dashed border-[var(--border)] bg-[var(--bg2)] px-3 py-1.5 font-mono text-[0.5rem] leading-relaxed text-[var(--muted)]">
          ⤓ Limite risque / exécution — ce qui précède dimensionne (taille, stops, prob de
          passage). Ci-dessous: exposition SPX via CFD US500 et hedge options listées
          SPX/XSP/Nanos. Le hedge protège le solde, il ne crée pas d'edge directionnel.
        </div>

        {/* TIER 3 — exposition US500 + hedge options */}
        <section className="flex flex-col gap-3">
          <TierLabel>Tier 3 · Exposition US500 · hedge SPX / XSP / Nanos</TierLabel>
          <Us500HedgeCard spec={spec} />
        </section>
      </main>

      <footer className="px-4 py-2 border-t border-[var(--border)] bg-[var(--bg2)] flex items-center justify-between font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[1.5px]">
        <span>Config statique: config/ftmo/*.json · MC seedé déterministe</span>
        <span className="text-[var(--dim)]">educational · not investment advice</span>
      </footer>
    </div>
  );
}

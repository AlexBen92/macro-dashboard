'use client';

import { cotColor, cotTooltip, type CotPayload } from '@/lib/cot';

export function CotHeader({ data }: { data: CotPayload | null }) {
  return (
    <span
      title="CFTC Commitment of Traders — net non-commercial en % de l'open interest, z-score 3y. Publication hebdaire vendredi, rapport daté mardi (lag ~J-7). Filtre contrarian de contexte UNTESTED — jamais validé par le protocole WF/DSR/PBO, pas un signal actionnable."
      className="whitespace-nowrap"
    >
      COT z{data?.as_of ? ` ⟨${data.as_of.slice(5)}⟩` : ''}
    </span>
  );
}

export function CotTd({
  ticker,
  data,
}: {
  ticker: string;
  data: CotPayload | null;
}) {
  const a = data?.assets[ticker];
  if (!a) {
    return (
      <td className="py-1.5 px-2 text-right text-[var(--dim)]" title="Pas de futures CFTC sur ce marché">
        —
      </td>
    );
  }
  return (
    <td
      className="py-1.5 px-2 text-right whitespace-nowrap"
      style={{ color: cotColor(a.z) }}
      title={cotTooltip(a)}
    >
      {a.z != null ? `${a.z > 0 ? '+' : ''}${a.z.toFixed(1)}` : '—'}
      <span className="text-[0.5rem] text-[var(--dim)] ml-1">
        {a.percentile != null ? `p${Math.round(a.percentile)}` : ''}
      </span>
    </td>
  );
}

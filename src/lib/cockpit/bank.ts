/**
 * Helpers purs banque de stratégies M15 (composant M15StrategiesBankCard).
 * Statut live vient du registre (fail-closed service) — ces helpers ne font
 * qu'afficher: aucun calcul de métrique, aucune dérivée client.
 */
import type { BankStrategy, M15StrategiesBank } from './payloads';

export function bankStatusColor(status: string): string {
  if (status === 'VALIDATED') return 'var(--bull)';
  if (status === 'REJECTED' || status === 'NULL') return 'var(--bear)';
  if (status === 'IN_VALIDATION') return 'var(--caution)';
  return 'var(--dim)'; // UNTESTED / inconnu — jamais vert
}

/**
 * Statut affiché: le catalogue (status_doc) ne peut que DURCIR l'affichage
 * (famille rejetée documentée sous clé registre générique UNTESTED), jamais
 * verdir. VALIDATEion affichée ⇔ status_live VALIDATED au registre.
 */
export function effectiveBankStatus(s: BankStrategy): string {
  if (s.status_live === 'VALIDATED') return 'VALIDATED';
  if (s.status_live === 'NULL') return 'REJECTED';
  if (s.status_doc === 'NULL' || s.status_doc === 'REJECTED') return 'REJECTED';
  if (s.blocked) return 'BLOQUÉ';
  return s.status_live;
}

export function bankStatusText(s: BankStrategy): string {
  const eff = effectiveBankStatus(s);
  if (eff === 'REJECTED') return s.blocked ? 'BLOQUÉ (données/clés)' : 'REJETÉ';
  if (eff === 'BLOQUÉ') return 'BLOQUÉ (données/clés)';
  if (eff === 'VALIDATED') return 'VALIDÉ';
  if (eff === 'IN_VALIDATION') return 'EN TEST';
  return 'NON TESTÉ';
}

export function groupByFamily(strategies: BankStrategy[]): Array<[string, BankStrategy[]]> {
  const groups = new Map<string, BankStrategy[]>();
  for (const s of strategies) {
    const key = s.family ?? 'sans_famille';
    const arr = groups.get(key);
    if (arr) arr.push(s);
    else groups.set(key, [s]);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export function formatBankMetrics(s: BankStrategy): string[] {
  const m = s.metrics ?? {};
  const out: string[] = [];
  if (m.holdout_n_trades !== undefined) out.push(`holdout n=${m.holdout_n_trades}`);
  if (m.worst_fold_bps !== undefined) out.push(`pire fold ${m.worst_fold_bps.toFixed(1)}bps/j`);
  if (m.holdout_mean_bps !== undefined) out.push(`holdout ${m.holdout_mean_bps.toFixed(1)}bps/j`);
  if (m.n_configs !== undefined) out.push(`${m.n_configs} configs`);
  return out; // vide si payload sans métriques — rien n'est inventé
}

export function retestNote(s: BankStrategy): string | null {
  if (effectiveBankStatus(s) === 'REJECTED') return 'jamais retester sans nouveau mécanisme documenté';
  if (s.blocked && s.revisit) return `revoir: ${s.revisit}`;
  return null;
}

export function bankHeadline(bank: M15StrategiesBank | null | undefined): string {
  if (!bank) return 'banque indisponible';
  return `${bank.n_strategies} stratégies · ${bank.n_validated} VALIDATED`;
}

/**
 * Kelly sizing pour l'allocation de bankroll à l'achat répété du challenge.
 * Dérivé de l'edge net et de sa variance sous la simulation de rachat en boucle
 * (ruin-analysis). Interprétation: fraction de bankroll pour l'achat répété
 * d'un produit potentiellement mal pricé — PAS un avantage directionnel.
 * Afficher toujours Kelly pleine + demi-Kelly (prudence).
 */

export interface KellyResult {
  fullKelly: number;
  halfKelly: number;
  /** version discrète win/loss si distribution bimodale fournie */
  discreteKelly: number | null;
  interpretation: string;
}

/** Kelly continu: f* = mean/var (approx petite edge), floored à 0. */
export function kellyFromPayoffs(payoffs: number[], fee: number): KellyResult {
  const n = payoffs.length;
  if (n === 0 || fee <= 0) {
    return {
      fullKelly: 0,
      halfKelly: 0,
      discreteKelly: null,
      interpretation: 'données insuffisantes',
    };
  }
  // normalisation par coût d'entrée: b = payoff/fee
  const b = payoffs.map((p) => p / fee);
  const mean = b.reduce((s, x) => s + x, 0) / n;
  const varr = b.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  let f = varr > 1e-12 ? mean / varr : 0;
  f = Math.max(0, Math.min(f, 1));
  const discrete = discreteKellyFromPayoffs(payoffs, fee);
  return {
    fullKelly: f,
    halfKelly: f / 2,
    discreteKelly: discrete,
    interpretation:
      'fraction de bankroll pour racheter le challenge en boucle (edge de pricing, pas un edge directionnel)',
  };
}

/** Kelly discret: f* = p − q/b avec p = P(net>0), b = gain moyen/gain... via moments. */
function discreteKellyFromPayoffs(payoffs: number[], fee: number): number | null {
  const wins = payoffs.filter((p) => p > 0);
  const losses = payoffs.filter((p) => p <= 0);
  if (wins.length === 0 || losses.length === 0) return null;
  const p = wins.length / payoffs.length;
  const q = 1 - p;
  const avgWin = wins.reduce((s, x) => s + x, 0) / wins.length;
  const avgLoss = Math.abs(losses.reduce((s, x) => s + x, 0) / losses.length);
  if (avgLoss <= 0) return null;
  const b = (avgWin + fee) / avgLoss; // gain net moyen par unité perdue
  const f = p - q / b;
  return Math.max(0, Math.min(f, 1));
}

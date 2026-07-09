'use client';

/**
 * V18 §5.3 §4 — Signature: motif wireframe surface de volatilité.
 *
 * Rendu filaire 1px `currentColor` (mist), 1 point `pulse` marquant le strike ATM.
 * À utiliser en arrière-plan de H2 "VOL SURFACE" ou en header de section.
 *
 * Pas de props couleur: hérite du parent. Hauteur fixée par prop `height` (default 80).
 */
export default function VolSurfaceMotif({
  height = 80,
  atmStrikeX = 0.5,
  className = '',
  opacity = 0.4,
}: {
  height?: number;
  atmStrikeX?: number;
  className?: string;
  opacity?: number;
}) {
  const W = 240;
  const H = height;
  const N = 6;

  // Génère N smiles d'IV à différents DTE (term structure), amortis en amplitude
  const smiles = Array.from({ length: N }, (_, i) => {
    const amort = 1 - i * 0.13;
    const yOffset = i * 4;
    const amp = 28 * amort;
    const pts: string[] = [];
    for (let x = 0; x <= W; x += 6) {
      const k = (x - W / 2) / (W / 2);
      const skew = -8 * k * amort;
      const y = H * 0.5 + yOffset + amp * (k * k) + skew;
      pts.push(`${x},${y.toFixed(1)}`);
    }
    return pts.join(' ');
  });

  // Term structure: 5 points à maturité croissante, ATM (k=0)
  const termPts: string[] = [];
  for (let i = 0; i < N; i++) {
    const x = W / 2;
    const yOffset = i * 4;
    const amp = 28 * (1 - i * 0.13);
    const y = H * 0.5 + yOffset + amp * 0 + (-8 * 0 * (1 - i * 0.13));
    termPts.push(`${x},${y.toFixed(1)}`);
  }

  const atmX = W * atmStrikeX;

  return (
    <svg
      width="100%"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ opacity }}
      className={className}
      aria-hidden="true"
    >
      {/* Smiles (skew par expiry) */}
      {smiles.map((d, i) => (
        <polyline
          key={`smile-${i}`}
          points={d}
          fill="none"
          stroke="currentColor"
          strokeWidth={0.7}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {/* Term structure verticale ATM */}
      <polyline
        points={termPts.join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={0.7}
        strokeDasharray="2 3"
        vectorEffect="non-scaling-stroke"
      />
      {/* Point ATM strike — pulse green */}
      <circle
        cx={atmX}
        cy={H * 0.5 + 4}
        r={2.5}
        fill="var(--bull, #4ade80)"
      />
      {/* Ligne ATM strike */}
      <line
        x1={atmX}
        y1={0}
        x2={atmX}
        y2={H}
        stroke="var(--bull, #4ade80)"
        strokeWidth={0.5}
        strokeDasharray="1 4"
        opacity={0.6}
      />
    </svg>
  );
}

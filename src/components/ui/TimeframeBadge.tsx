'use client';

const TF_COLORS: Record<string, string> = {
  D1: '#aa66ff',
  H4: '#00e5ff',
  H1: '#4ade80',
  M15: '#ffaa00',
  M5: '#ff3355',
  '24h': '#d4a017',
  '8h': '#2980b9',
  '90d': '#aa66ff',
  '30d': '#00e5ff',
};

export default function TimeframeBadge({ tf }: { tf: string }) {
  const color = TF_COLORS[tf] || '#556680';
  return (
    <span
      className="font-mono text-[0.68rem] font-bold px-1.5 py-0.5 rounded"
      style={{ color, background: `${color}15`, border: `1px solid ${color}40` }}
    >
      {tf}
    </span>
  );
}

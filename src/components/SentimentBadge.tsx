'use client';

const BADGE_COLORS: Record<string, string> = {
  'STRONG LONG': '#00e5ff',
  'LONG BIAS': '#4ade80',
  'NEUTRAL': '#a0a0b8',
  'SHORT BIAS': '#ff8800',
  'STRONG SHORT': '#ff006e',
};

export default function SentimentBadge({ sentiment }: { sentiment: string }) {
  const color = BADGE_COLORS[sentiment] || '#a0a0b8';
  return (
    <span
      className="font-mono text-[0.6rem] font-semibold px-2 py-0.5 rounded border"
      style={{ color, borderColor: color + '44', background: color + '11' }}
    >
      {sentiment}
    </span>
  );
}

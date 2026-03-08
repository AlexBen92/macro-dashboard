'use client';

export default function Countdown({ name, countdown, hoursLeft }: {
  name: string;
  countdown: string;
  hoursLeft: number;
}) {
  const cls = hoursLeft < 24 ? 'text-[#ff3355]' : hoursLeft < 72 ? 'text-[#ffaa00]' : 'text-[#4ade80]';
  return (
    <div className="font-mono text-[0.75rem] text-[#a0a0b8] text-center">
      <span className={cls}>{name} {countdown}</span>
    </div>
  );
}

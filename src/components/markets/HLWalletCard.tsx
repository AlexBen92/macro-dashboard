'use client';

import { useHlWallet } from '@/hooks/api/useHlWallet';

function fmtUsd(v: number): string {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pnlColor(v: number): string {
  if (v > 0) return 'var(--bull)';
  if (v < 0) return 'var(--bear)';
  return 'var(--muted)';
}

function addrShort(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function HLWalletCard() {
  const { data, isLoading, error } = useHlWallet();
  const flat = data !== null && data.positions.length === 0;
  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-[0.72rem] text-[var(--label)] tracking-[3px] uppercase">
          HL Wallet{' '}
          <span className="text-[0.58rem] text-[var(--muted)] ml-2">{addrShort('0x6eBB536e529bE4c5aCF2D8AeE16D56b07BaD8731')}</span>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && !data ? (
            <span className="font-mono text-[0.55rem] text-[var(--muted)] tracking-[2px] uppercase">loading…</span>
          ) : error ? (
            <span className="font-mono text-[0.55rem] tracking-[2px] uppercase" style={{ color: 'var(--bear)' }}>HL unreachable</span>
          ) : (
            <span className="font-mono text-[0.55rem] text-[var(--bull)] tracking-[2px] uppercase">live · 30s</span>
          )}
        </div>
      </div>

      {error && (
        <div className="font-mono text-[0.6rem] text-[var(--muted)] py-3">
          lecture publique hyperliquid impossible — retry auto 30s
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
            <div>
              <div className="font-mono text-[0.52rem] text-[var(--muted)] tracking-[2px] uppercase">Total (perp+spot)</div>
              <div className="font-mono text-[0.95rem]" style={{ color: 'var(--fg)' }}>${fmtUsd(data.totalEquity)}</div>
            </div>
            <div>
              <div className="font-mono text-[0.52rem] text-[var(--muted)] tracking-[2px] uppercase">Perp</div>
              <div className="font-mono text-[0.95rem]">${fmtUsd(data.accountValue)}</div>
            </div>
            <div>
              <div className="font-mono text-[0.52rem] text-[var(--muted)] tracking-[2px] uppercase">Spot USDC</div>
              <div className="font-mono text-[0.95rem]">${fmtUsd(data.spotUsdc)}</div>
            </div>
            <div>
              <div className="font-mono text-[0.52rem] text-[var(--muted)] tracking-[2px] uppercase">Margin Used</div>
              <div className="font-mono text-[0.95rem]">${fmtUsd(data.marginUsed)}</div>
            </div>
            <div>
              <div className="font-mono text-[0.52rem] text-[var(--muted)] tracking-[2px] uppercase">Notional Pos</div>
              <div className="font-mono text-[0.95rem]">${fmtUsd(data.notionalPos)}</div>
            </div>
          </div>

          {flat && data.spotUsdc > 0 && (
            <div className="font-mono text-[0.6rem] py-2 border-t border-[var(--border)]" style={{ color: 'var(--caution)' }}>
              FLAT perp · ${fmtUsd(data.spotUsdc)} USDC parqués sur le spot
            </div>
          )}
          {flat && data.spotUsdc === 0 && (
            <div className="font-mono text-[0.6rem] text-[var(--muted)] py-2 border-t border-[var(--border)]">
              FLAT — aucune position ouverte
            </div>
          )}
          {!flat && (
            <div className="overflow-x-auto border-t border-[var(--border)]">
              <table className="w-full font-mono text-[0.62rem] min-w-[680px]">
                <thead>
                  <tr className="text-[0.55rem] text-[var(--muted)] tracking-[2px] uppercase border-b border-[var(--border)]">
                    <th className="text-left py-2 pr-3">Coin</th>
                    <th className="text-right py-2 px-2">Size</th>
                    <th className="text-right py-2 px-2">Entry</th>
                    <th className="text-right py-2 px-2">Value</th>
                    <th className="text-right py-2 px-2">uPnL</th>
                    <th className="text-right py-2 px-2">ROE</th>
                    <th className="text-right py-2 px-2">Lev</th>
                    <th className="text-right py-2 pl-2">Liq Px</th>
                  </tr>
                </thead>
                <tbody>
                  {data.positions.map((p) => {
                    const upnl = Number(p.unrealizedPnl);
                    const roe = Number(p.returnOnEquity) * 100;
                    return (
                      <tr key={p.coin} className="border-b border-[var(--border)] last:border-0">
                        <td className="py-2 pr-3">
                          <span style={{ color: p.isLong ? 'var(--bull)' : 'var(--bear)' }}>
                            {p.isLong ? '▲' : '▼'}
                          </span>{' '}
                          {p.coin}
                        </td>
                        <td className="text-right py-2 px-2">{Math.abs(p.szi)}</td>
                        <td className="text-right py-2 px-2">{p.entryPx ?? '—'}</td>
                        <td className="text-right py-2 px-2">${fmtUsd(Number(p.positionValue))}</td>
                        <td className="text-right py-2 px-2" style={{ color: pnlColor(upnl) }}>
                          {upnl >= 0 ? '+' : ''}{fmtUsd(upnl)}
                        </td>
                        <td className="text-right py-2 px-2" style={{ color: pnlColor(roe) }}>
                          {roe >= 0 ? '+' : ''}{roe.toFixed(2)}%
                        </td>
                        <td className="text-right py-2 px-2 text-[var(--muted)]">{p.leverage}x</td>
                        <td className="text-right py-2 pl-2 text-[var(--muted)]">{p.liquidationPx ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {data.fills.length > 0 && (
            <div className="mt-3 pt-2 border-t border-[var(--border)]">
              <div className="font-mono text-[0.52rem] text-[var(--muted)] tracking-[2px] uppercase mb-1.5">Derniers fills</div>
              <div className="space-y-1">
                {data.fills.slice(0, 5).map((f, i) => {
                  const pnl = Number(f.closedPnl);
                  return (
                    <div key={`${f.time}-${i}`} className="flex items-center justify-between font-mono text-[0.58rem]">
                      <span className="text-[var(--muted)]">
                        {new Date(f.time).toISOString().slice(5, 16).replace('T', ' ')}Z{' '}
                        <span className="text-[var(--fg)]">{f.coin}</span> {f.dir} @ {f.px} × {f.sz}
                      </span>
                      <span style={{ color: pnlColor(pnl) }}>
                        {pnl !== 0 ? `${pnl >= 0 ? '+' : ''}${fmtUsd(pnl)}` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  INITIAL_BALANCE,
  calcQty,
  calcPnl,
  calcAccountMetrics,
  type VirtualTrade,
  type VirtualAccount,
  type AccountMetrics,
  type AccountType,
} from '@/lib/virtualAccount';

function storageKey(type: AccountType) {
  return `virtual_account_v1_${type}`;
}

function loadAccount(type: AccountType): VirtualAccount {
  if (typeof window === 'undefined') return initAccount(type);
  try {
    const raw = localStorage.getItem(storageKey(type));
    if (raw) return JSON.parse(raw) as VirtualAccount;
  } catch { /* ignore */ }
  return initAccount(type);
}

function initAccount(type: AccountType): VirtualAccount {
  return {
    type,
    initialBalance: INITIAL_BALANCE,
    balance: INITIAL_BALANCE,
    equity: INITIAL_BALANCE,
    trades: [],
  };
}

function saveAccount(account: VirtualAccount) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(account.type), JSON.stringify(account));
  } catch { /* storage full */ }
}

// Recompute unrealised equity from open trades using live prices
function computeEquity(account: VirtualAccount, livePrices: Record<string, number>): number {
  let unrealised = 0;
  for (const t of account.trades) {
    if (t.status !== 'OPEN') continue;
    const livePrice = livePrices[t.instrument];
    if (!livePrice) continue;
    const priceDiff = t.direction === 'LONG' ? livePrice - t.entry : t.entry - livePrice;
    const grossPnl = priceDiff * t.qty;
    const feeExit = t.qty * livePrice * 0.0004;
    unrealised += grossPnl - feeExit;
  }
  return account.balance + unrealised;
}

export function useVirtualAccount(type: AccountType, livePrices: Record<string, number> = {}) {
  const [account, setAccount] = useState<VirtualAccount>(() => initAccount(type));
  const [metrics, setMetrics] = useState<AccountMetrics>(() => calcAccountMetrics(initAccount(type)));

  useEffect(() => {
    const loaded = loadAccount(type);
    setAccount(loaded);
    setMetrics(calcAccountMetrics(loaded));
  }, [type]);

  // Update equity whenever live prices change
  useEffect(() => {
    setAccount(prev => {
      const equity = computeEquity(prev, livePrices);
      const updated = { ...prev, equity };
      setMetrics(calcAccountMetrics(updated));
      return updated;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(livePrices)]);

  const openTrade = useCallback((params: {
    instrument: string;
    direction: 'LONG' | 'SHORT';
    entry: number;
    stop: number;
    tp: number;
    riskPct?: number;
    signals?: string[];
    notes?: string;
  }) => {
    setAccount(prev => {
      const { qty, riskUsd, feeEntry } = calcQty(prev.balance, params.entry, params.stop, params.riskPct);
      if (qty <= 0) return prev;

      // Deduct entry fee from balance immediately
      const feeExitEstimated = qty * params.tp * 0.0004; // estimated at TP price
      const newTrade: VirtualTrade = {
        id: `vt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        account: type,
        instrument: params.instrument,
        direction: params.direction,
        entry: params.entry,
        stop: params.stop,
        tp: params.tp,
        qty,
        riskUsd,
        feeEntry,
        feeExit: feeExitEstimated,
        openedAt: new Date().toISOString(),
        closedAt: null,
        exit: null,
        status: 'OPEN',
        pnlGross: null,
        pnlNet: null,
        pnlR: null,
        balanceAfter: null,
        signals: params.signals,
        notes: params.notes,
      };

      const updated: VirtualAccount = {
        ...prev,
        balance: Math.round((prev.balance - feeEntry) * 100) / 100,
        trades: [...prev.trades, newTrade],
      };
      updated.equity = computeEquity(updated, livePrices);
      saveAccount(updated);
      setMetrics(calcAccountMetrics(updated));
      return updated;
    });
  }, [type, livePrices]);

  const closeTrade = useCallback((id: string, exitPrice: number) => {
    setAccount(prev => {
      const trade = prev.trades.find(t => t.id === id);
      if (!trade || trade.status !== 'OPEN') return prev;

      const { pnlGross, feeExit, pnlNet, pnlR, status } = calcPnl(trade, exitPrice);
      const newBalance = Math.round((prev.balance + pnlGross - feeExit) * 100) / 100;

      const updatedTrade: VirtualTrade = {
        ...trade,
        exit: exitPrice,
        closedAt: new Date().toISOString(),
        status,
        pnlGross,
        feeExit,
        pnlNet,
        pnlR,
        balanceAfter: newBalance,
      };

      const updated: VirtualAccount = {
        ...prev,
        balance: newBalance,
        trades: prev.trades.map(t => t.id === id ? updatedTrade : t),
      };
      updated.equity = computeEquity(updated, livePrices);
      saveAccount(updated);
      setMetrics(calcAccountMetrics(updated));
      return updated;
    });
  }, [livePrices]);

  // Close at SL or TP automatically (called when price crosses levels)
  const autoClose = useCallback((instrument: string, currentPrice: number) => {
    setAccount(prev => {
      let changed = false;
      const newTrades = prev.trades.map(t => {
        if (t.status !== 'OPEN' || t.instrument !== instrument) return t;
        const hitSL = t.direction === 'LONG' ? currentPrice <= t.stop : currentPrice >= t.stop;
        const hitTP = t.direction === 'LONG' ? currentPrice >= t.tp : currentPrice <= t.tp;
        if (!hitSL && !hitTP) return t;
        changed = true;
        const exitPrice = hitTP ? t.tp : t.stop;
        const { pnlGross, feeExit, pnlNet, pnlR, status } = calcPnl(t, exitPrice);
        return {
          ...t,
          exit: exitPrice,
          closedAt: new Date().toISOString(),
          status,
          pnlGross,
          feeExit,
          pnlNet,
          pnlR,
          balanceAfter: 0, // will be recalculated
        };
      });

      if (!changed) return prev;

      // Recalculate balance sequentially
      let bal = INITIAL_BALANCE;
      // Start from initial, replay all closed trades in order
      const closedInOrder = newTrades
        .filter(t => t.status !== 'OPEN' && t.pnlGross != null)
        .sort((a, b) => (a.closedAt ?? '').localeCompare(b.closedAt ?? ''));

      // Rebuild fee-deducted balance
      // Entry fees are deducted on open, so we track them separately
      const entryFeesPaid: Record<string, number> = {};
      for (const t of prev.trades) {
        entryFeesPaid[t.id] = t.feeEntry;
      }

      bal = INITIAL_BALANCE;
      for (const t of newTrades) {
        if (t.status === 'OPEN') continue;
        if (t.pnlGross == null) continue;
        bal = Math.round((bal - (entryFeesPaid[t.id] ?? 0) + (t.pnlGross ?? 0) - (t.feeExit ?? 0)) * 100) / 100;
        (t as VirtualTrade).balanceAfter = bal;
      }

      const updated: VirtualAccount = {
        ...prev,
        balance: bal,
        trades: newTrades,
      };
      updated.equity = computeEquity(updated, livePrices);
      saveAccount(updated);
      setMetrics(calcAccountMetrics(updated));
      return updated;
    });
  }, [livePrices]);

  const deleteTrade = useCallback((id: string) => {
    setAccount(prev => {
      const trade = prev.trades.find(t => t.id === id);
      if (!trade) return prev;
      // If open, refund entry fee
      const refund = trade.status === 'OPEN' ? trade.feeEntry : 0;
      // If closed, remove its pnl effect — rebuild balance
      const remaining = prev.trades.filter(t => t.id !== id);
      let bal = INITIAL_BALANCE;
      for (const t of remaining) {
        if (t.status === 'OPEN') { bal -= t.feeEntry; continue; }
        if (t.pnlGross == null) continue;
        bal = Math.round((bal - t.feeEntry + (t.pnlGross ?? 0) - (t.feeExit ?? 0)) * 100) / 100;
      }
      // Re-deduct open trades entry fees
      for (const t of remaining.filter(t => t.status === 'OPEN')) {
        bal -= t.feeEntry;
      }
      const updated: VirtualAccount = {
        ...prev,
        balance: Math.round((bal) * 100) / 100,
        trades: remaining,
      };
      updated.equity = computeEquity(updated, livePrices);
      saveAccount(updated);
      setMetrics(calcAccountMetrics(updated));
      return updated;
    });
  }, [livePrices]);

  const resetAccount = useCallback(() => {
    const fresh = initAccount(type);
    saveAccount(fresh);
    setAccount(fresh);
    setMetrics(calcAccountMetrics(fresh));
  }, [type]);

  return {
    account,
    metrics,
    openTrade,
    closeTrade,
    autoClose,
    deleteTrade,
    resetAccount,
  };
}

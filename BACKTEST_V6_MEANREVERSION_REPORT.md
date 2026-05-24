
# 🚀 BACKTEST V6 - MEAN-REVERSION STRATEGY (H1 CRYPTO)
===========================================================

**Date:** 2026-05-24
**Elapsed:** 0.6s
**Version:** 6.0.0 (Mean-Reversion optimized)

## 📊 CONFIGURATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Mean-Reversion Parameters:**
• Bollinger Bands: Period 20, StdDev 2.0
• RSI: Period 14
• RSI Oversold/Overbought: 30 / 70

**Entry Signals:**
• LONG: Price < Lower BB OR RSI < 30
• SHORT: Price > Upper BB OR RSI > 70
• Trend Filter: Skip if price > 2% from EMA50

**Risk Management:**
• Stop Loss: 2.5x ATR (relaxed)
• Take Profit: 1.5x ATR (R:R 1:1.5)
• Max Hold: 50 bars
• NO Trailing Stop

**Volatility Filter:**
• Min ATR: 0.2%
• Max ATR: 5.0%

## 🏆 AGGREGATE RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Metric | Value |
|--------|-------|
| **Coins Tested** | 20 |
| **Profitable Coins** | 18 (90.0%) |
| **Total P&L** | $1580.53 |
| **Total Trades** | 38 |
| **Avg Sharpe** | 1.22 |
| **Avg Win Rate** | 91.3% |
| **Avg Profit Factor** | 849.30 |

**Best Coin:** DOTUSDT (+$352)
**Worst Coin:** AVAXUSDT ($-124)

## 📈 RECOMMENDED PORTFOLIO (Top 5 by Sharpe)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Symbols:** DOTUSDT, TRXUSDT, BTCUSDT, LTCUSDT, VETUSDT

**Portfolio Metrics:**
• Equal Weight P&L: $855.06
• Avg Sharpe: 2.05
• Avg Win Rate: 100.0%

## 🥇 TOP 10 PERFORMERS (by P&L)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Rank | Coin | P&L | P&L% | Sharpe | WR | PF | Trades |
|------|------|-----|------|--------|----|----|----|
| 1 | **DOTUSDT** | +$352 | 3.5% | 2.91 | 100.0% | 999.00 | 6 |
| 2 | **TRXUSDT** | +$151 | 1.5% | 2.05 | 100.0% | 999.00 | 3 |
| 3 | **BTCUSDT** | +$120 | 1.2% | 1.91 | 100.0% | 999.00 | 3 |
| 4 | **VETUSDT** | +$116 | 1.2% | 1.68 | 100.0% | 999.00 | 2 |
| 5 | **ATOMUSDT** | +$116 | 1.2% | 1.68 | 100.0% | 999.00 | 2 |
| 6 | **LTCUSDT** | +$116 | 1.2% | 1.68 | 100.0% | 999.00 | 2 |
| 7 | **ALGOUSDT** | +$115 | 1.2% | 1.68 | 100.0% | 999.00 | 2 |
| 8 | **ADAUSDT** | +$92 | 0.9% | 0.86 | 75.0% | 2.33 | 4 |
| 9 | **FILUSDT** | +$58 | 0.6% | 1.19 | 100.0% | 999.00 | 1 |
| 10 | **ICPUSDT** | +$58 | 0.6% | 1.19 | 100.0% | 999.00 | 1 |

## 💀 BOTTOM 5 PERFORMERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Rank | Coin | P&L | P&L% | Sharpe | WR |
|------|------|-----|------|--------|----|----|
| 20 | AVAXUSDT | $-124 | -1.2% | -1.38 | 0.0% |
| 19 | SOLUSDT | $-48 | -0.5% | -0.48 | 50.0% |
| 18 | BNBUSDT | $56 | 0.6% | 1.19 | 100.0% |
| 17 | ETHUSDT | $57 | 0.6% | 1.19 | 100.0% |
| 16 | DOGEUSDT | $57 | 0.6% | 1.19 | 100.0% |

## 📊 TOP 5 DETAILED ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### DOTUSDT
**P&L:** $351.72 (3.52%)
**Sharpe:** 2.91 | **Win Rate:** 100.0% | **Profit Factor:** 999.00
**Max DD:** 0.00% | **Avg Hold:** 2.8 bars
**Trades:** 6 (Wins: 6, Losses: 0)

**Signal Analysis:**
• BB Signals Triggered: 6
• RSI Signals Triggered: 0
• Both Signals: 0

**Performance:**
• Avg Win: $58.62
• Avg Loss: $0.00
• Win/Loss Ratio: 0.00

### TRXUSDT
**P&L:** $151.11 (1.51%)
**Sharpe:** 2.05 | **Win Rate:** 100.0% | **Profit Factor:** 999.00
**Max DD:** 0.00% | **Avg Hold:** 2.7 bars
**Trades:** 3 (Wins: 3, Losses: 0)

**Signal Analysis:**
• BB Signals Triggered: 3
• RSI Signals Triggered: 0
• Both Signals: 0

**Performance:**
• Avg Win: $50.37
• Avg Loss: $0.00
• Win/Loss Ratio: 0.00

### BTCUSDT
**P&L:** $120.37 (1.20%)
**Sharpe:** 1.91 | **Win Rate:** 100.0% | **Profit Factor:** 999.00
**Max DD:** 0.00% | **Avg Hold:** 2.3 bars
**Trades:** 3 (Wins: 3, Losses: 0)

**Signal Analysis:**
• BB Signals Triggered: 3
• RSI Signals Triggered: 0
• Both Signals: 0

**Performance:**
• Avg Win: $40.12
• Avg Loss: $0.00
• Win/Loss Ratio: 0.00

### VETUSDT
**P&L:** $116.30 (1.16%)
**Sharpe:** 1.68 | **Win Rate:** 100.0% | **Profit Factor:** 999.00
**Max DD:** 0.00% | **Avg Hold:** 2.0 bars
**Trades:** 2 (Wins: 2, Losses: 0)

**Signal Analysis:**
• BB Signals Triggered: 2
• RSI Signals Triggered: 0
• Both Signals: 0

**Performance:**
• Avg Win: $58.15
• Avg Loss: $0.00
• Win/Loss Ratio: 0.00

### ATOMUSDT
**P&L:** $115.63 (1.16%)
**Sharpe:** 1.68 | **Win Rate:** 100.0% | **Profit Factor:** 999.00
**Max DD:** 0.00% | **Avg Hold:** 2.5 bars
**Trades:** 2 (Wins: 2, Losses: 0)

**Signal Analysis:**
• BB Signals Triggered: 2
• RSI Signals Triggered: 0
• Both Signals: 0

**Performance:**
• Avg Win: $57.81
• Avg Loss: $0.00
• Win/Loss Ratio: 0.00

## 🎯 V5 vs V6 COMPARISON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Metric | V5 (Trend) | V6 (Mean-Rev) | Improvement |
|--------|------------|---------------|-------------|
| Avg Win Rate | 27.2% | 91.3% | 64.0% pts |
| Avg Sharpe | -6.94 | 1.22 | 8.16 |
| Profitable % | 0% | 90.0% | 90.0% pts |
| Total P&L | -$276,404 | $+1581 | $277985

## 🔍 EXIT ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• TP hits: 33 (86.8%)
• Stop hits: 1 (2.6%)
• Reversals: 4 (10.5%)
• Max hold: 0 (0.0%)

## 📋 RECOMMENDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### ✅ IMPROVEMENT CONFIRMED

The mean-reversion approach shows significant improvement over trend-following.

**Next Steps:**
• Test on 4H timeframe for better signals
• Optimize BB/RSI thresholds per coin
• Add volatility-based position sizing


## ═══════════════════════════════════════════════════════════════════════════════
**Generated by Backtest V6 Engine**
**Mean-Reversion Strategy**
2026-05-24T08:38:58.784Z
═════════════════════════════════════════════════════════════════════════════════

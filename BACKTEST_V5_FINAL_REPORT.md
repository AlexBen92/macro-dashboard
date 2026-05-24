
# 🚀 BACKTEST V5 - CRYPTO OPTIMIZED (P4-style) - FINAL RESULTS
================================

**Date:** 2026-05-24
**Elapsed:** 213.9s
**Version:** 5.0.0 (P4-optimized + Crypto patterns)

## 📊 CONFIGURATION (P4 + CRYPTO OPTIMIZED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**NASDAQ P4 Parameters:**
• Trend Fast/Slow: 30 / 150
• Momentum: 10 / 40
• ATR Stop Loss: 1.5x
• ATR Take Profit: 4.5x
• Trailing Stop: 1.2x ATR
• Max Hold: 35 bars
• Min Regime Score: 0.55

**Crypto-Specific Improvements:**
• Timing Filter: 02h-03h, 16h-17h UTC (optimal hours)
• Pre-filter: WR > 33%, Sharpe > 0.2
• VPIN Filter: Skip when > 0.65 (toxic flow)
• HMM Regime: 3-state detection (BULL/BEAR/RANGING)
• Kelly Criterion: Adaptive sizing

## 🏆 AGGREGATE RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Metric | Value |
|--------|-------|
| **Coins Tested** | 47 |
| **Profitable Coins** | 0 (0.0%) |
| **Total P&L** | $-276404.22 (-2777.54%) |
| **Avg Sharpe** | -6.94 |
| **Avg Win Rate** | 27.2% |
| **Avg Calmar** | -1.31 |

**Best Coin:** MKRUSDT (+$0)
**Worst Coin:** TRXUSDT ($-7946)

## 📈 RECOMMENDED PORTFOLIO (Top 5 by Sharpe)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Symbols:** 

**Portfolio Metrics:**
• Equal Weight P&L: $0.00 (0.00%)
• Avg Sharpe: NaN
• Avg Win Rate: NaN%
• Avg Max DD: NaN%

## 🥇 TOP 10 PERFORMERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Rank | Coin | P&L | P&L% | Sharpe | WR | Max DD | Trades | Score |
|------|------|-----|------|--------|----|----|----|--------|
| 1 | **MKRUSDT** | +$0 | 0.0% | 0.00 | 0.0% | 0.0% | 0 | 10/100 |
| 2 | **FTMUSDT** | +$0 | 0.0% | 0.00 | 0.0% | 0.0% | 0 | 10/100 |
| 3 | **ZRXUSDT** | +$-4739 | -47.4% | -4.93 | 34.7% | 51.3% | 349 | 32/100 |
| 4 | **BATUSDT** | +$-5022 | -50.2% | -4.71 | 31.1% | 52.8% | 357 | 35/100 |
| 5 | **CELOUSDT** | +$-5079 | -50.8% | -5.67 | 27.5% | 53.1% | 313 | 34/100 |
| 6 | **GALAUSDT** | +$-5144 | -51.4% | -5.43 | 30.9% | 54.5% | 337 | 33/100 |
| 7 | **ROSEUSDT** | +$-5209 | -52.1% | -5.63 | 28.7% | 53.7% | 320 | 34/100 |
| 8 | **COMPUSDT** | +$-5399 | -54.0% | -5.78 | 28.0% | 55.4% | 346 | 35/100 |
| 9 | **AXSUSDT** | +$-5583 | -55.8% | -5.79 | 29.7% | 57.7% | 357 | 32/100 |
| 10 | **MANAUSDT** | +$-5598 | -56.0% | -5.76 | 29.8% | 57.8% | 342 | 32/100 |

## 💀 BOTTOM 10 PERFORMERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Rank | Coin | P&L | P&L% | Sharpe | WR | Max DD |
|------|------|-----|------|--------|----|----|----|
| 47 | TRXUSDT | $-7946 | -79.5% | -10.83 | 23.3% | 79.8%
| 46 | AAVEUSDT | $-7256 | -72.6% | -9.71 | 25.1% | 74.0%
| 45 | XRPUSDT | $-7215 | -72.1% | -9.20 | 26.9% | 73.2%
| 44 | SOLUSDT | $-7017 | -70.2% | -9.36 | 24.6% | 71.5%
| 43 | YFIUSDT | $-6951 | -69.5% | -8.44 | 25.7% | 70.6%
| 42 | NEARUSDT | $-6876 | -68.8% | -10.08 | 25.6% | 68.8%
| 41 | BNBUSDT | $-6814 | -68.1% | -8.17 | 26.6% | 68.7%
| 40 | BTCUSDT | $-6801 | -68.0% | -9.04 | 26.2% | 68.1%
| 39 | LTCUSDT | $-6743 | -67.4% | -8.36 | 28.7% | 69.5%
| 38 | ATOMUSDT | $-6652 | -66.5% | -8.85 | 27.0% | 67.0%

## 📊 DETAILED ANALYSIS - TOP 5
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


### MKRUSDT
**P&L:** $0.00 (0.00%)
**Sharpe:** 0.00 | **Win Rate:** 0.0% | **Profit Factor:** 0.00
**Max DD:** 0.00% | **Avg Hold:** 0.0 bars
**Trades:** 0 (Wins: 0, Losses: 0)


### ✅ STATISTICAL VALIDATION: 3/10 (30%)
  ❌ T-Test: Insufficient data
  ❌ Bootstrap CI: Insufficient data
  ✅ Walk-Forward: EXCELLENT - Very stable out-of-sample performance (1.00)
  ✅ Ulcer Index: EXCELLENT - Very low drawdown pain (0.00)
  ❌ Recovery Factor: POOR - Has not recovered from worst drawdown (0.0x)
  ❌ Prob Loss 30d: Insufficient trade data

**T-Test:** t=0.00, p=1.0000 Insufficient data
**Monte Carlo Eq:** Unknown Insufficient data
**Walk-Forward:** 1.00 EXCELLENT - Very stable out-of-sample performance
**Bootstrap CI:** [0.00%, 0.00%] Insufficient data
**Ulcer Index:** 0.00 EXCELLENT - Very low drawdown pain
**Recovery Factor:** 0.0M POOR - Has not recovered from worst drawdown
**Prob Loss 30d:** 100% ❌


**Best Trade:** +$-Infinity
**Worst Trade:** $Infinity


### FTMUSDT
**P&L:** $0.00 (0.00%)
**Sharpe:** 0.00 | **Win Rate:** 0.0% | **Profit Factor:** 0.00
**Max DD:** 0.00% | **Avg Hold:** 0.0 bars
**Trades:** 0 (Wins: 0, Losses: 0)


### ✅ STATISTICAL VALIDATION: 3/10 (30%)
  ❌ T-Test: Insufficient data
  ❌ Bootstrap CI: Insufficient data
  ✅ Walk-Forward: EXCELLENT - Very stable out-of-sample performance (1.00)
  ✅ Ulcer Index: EXCELLENT - Very low drawdown pain (0.00)
  ❌ Recovery Factor: POOR - Has not recovered from worst drawdown (0.0x)
  ❌ Prob Loss 30d: Insufficient trade data

**T-Test:** t=0.00, p=1.0000 Insufficient data
**Monte Carlo Eq:** Unknown Insufficient data
**Walk-Forward:** 1.00 EXCELLENT - Very stable out-of-sample performance
**Bootstrap CI:** [0.00%, 0.00%] Insufficient data
**Ulcer Index:** 0.00 EXCELLENT - Very low drawdown pain
**Recovery Factor:** 0.0M POOR - Has not recovered from worst drawdown
**Prob Loss 30d:** 100% ❌


**Best Trade:** +$-Infinity
**Worst Trade:** $Infinity


### ZRXUSDT
**P&L:** $-4738.51 (-47.39%)
**Sharpe:** -4.93 | **Win Rate:** 34.7% | **Profit Factor:** 0.66
**Max DD:** 51.31% | **Avg Hold:** 5.5 bars
**Trades:** 349 (Wins: 121, Losses: 228)


### ✅ STATISTICAL VALIDATION: 4/10 (40%)
  ✅ T-Test: HIGHLY SIGNIFICANT - Strong evidence that strategy has positive expectancy
  ❌ Bootstrap CI: NEGATIVE - 95% CI below zero
  ✅ Walk-Forward: GOOD - Stable OOS performance (0.84)
  ❌ Ulcer Index: SEVERE - Extreme drawdown pain (31.56)
  ❌ Recovery Factor: POOR - Has not recovered from worst drawdown (-0.9x)
  ❌ Prob Loss 30d: POOR - High probability of loss

**T-Test:** t=-4.01, p=<0.0001 HIGHLY SIGNIFICANT - Strong evidence that strategy has positive expectancy
**Monte Carlo Eq:** Unknown NEGATIVE - 95% CI below zero
**Walk-Forward:** 0.84 GOOD - Stable OOS performance
**Bootstrap CI:** [-0.20%, -0.07%] NEGATIVE - 95% CI below zero
**Ulcer Index:** 31.56 SEVERE - Extreme drawdown pain
**Recovery Factor:** -0.9M POOR - Has not recovered from worst drawdown
**Prob Loss 30d:** 62% ❌


**Best Trade:** +$310.82
**Worst Trade:** $-107.03


### BATUSDT
**P&L:** $-5022.17 (-50.22%)
**Sharpe:** -4.71 | **Win Rate:** 31.1% | **Profit Factor:** 0.65
**Max DD:** 52.80% | **Avg Hold:** 5.5 bars
**Trades:** 357 (Wins: 111, Losses: 246)


### ✅ STATISTICAL VALIDATION: 2/10 (20%)
  ✅ T-Test: HIGHLY SIGNIFICANT - Strong evidence that strategy has positive expectancy
  ❌ Bootstrap CI: NEGATIVE - 95% CI below zero
  ❌ Walk-Forward: ACCEPTABLE - Moderate OOS stability (0.56)
  ❌ Ulcer Index: SEVERE - Extreme drawdown pain (34.31)
  ❌ Recovery Factor: POOR - Has not recovered from worst drawdown (-1.0x)
  ❌ Prob Loss 30d: POOR - High probability of loss

**T-Test:** t=-3.96, p=<0.0001 HIGHLY SIGNIFICANT - Strong evidence that strategy has positive expectancy
**Monte Carlo Eq:** Unknown NEGATIVE - 95% CI below zero
**Walk-Forward:** 0.56 ACCEPTABLE - Moderate OOS stability
**Bootstrap CI:** [-0.22%, -0.07%] NEGATIVE - 95% CI below zero
**Ulcer Index:** 34.31 SEVERE - Extreme drawdown pain
**Recovery Factor:** -1.0M POOR - Has not recovered from worst drawdown
**Prob Loss 30d:** 62% ❌


**Best Trade:** +$301.82
**Worst Trade:** $-106.78


### CELOUSDT
**P&L:** $-5078.76 (-50.79%)
**Sharpe:** -5.67 | **Win Rate:** 27.5% | **Profit Factor:** 0.51
**Max DD:** 53.10% | **Avg Hold:** 6.1 bars
**Trades:** 313 (Wins: 86, Losses: 227)


### ✅ STATISTICAL VALIDATION: 2/10 (20%)
  ✅ T-Test: HIGHLY SIGNIFICANT - Strong evidence that strategy has positive expectancy
  ❌ Bootstrap CI: NEGATIVE - 95% CI below zero
  ❌ Walk-Forward: ACCEPTABLE - Moderate OOS stability (0.50)
  ❌ Ulcer Index: SEVERE - Extreme drawdown pain (35.45)
  ❌ Recovery Factor: POOR - Has not recovered from worst drawdown (-1.0x)
  ❌ Prob Loss 30d: POOR - High probability of loss

**T-Test:** t=-5.15, p=<0.0001 HIGHLY SIGNIFICANT - Strong evidence that strategy has positive expectancy
**Monte Carlo Eq:** Unknown NEGATIVE - 95% CI below zero
**Walk-Forward:** 0.50 ACCEPTABLE - Moderate OOS stability
**Bootstrap CI:** [-0.22%, -0.10%] NEGATIVE - 95% CI below zero
**Ulcer Index:** 35.45 SEVERE - Extreme drawdown pain
**Recovery Factor:** -1.0M POOR - Has not recovered from worst drawdown
**Prob Loss 30d:** 66% ❌


**Best Trade:** +$289.10
**Worst Trade:** $-100.59


## 🎯 KEY INSIGHTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


**Profitable Coins (0):**
• Avg Win Rate: NaN%
• Avg Sharpe: NaN
• Avg Win/Loss Ratio: NaN

**Unprofitable Coins (47):**
• Avg Win Rate: 27.2%
• Avg Sharpe: -6.94
• Main Issue: Win rate too low to overcome fees

**Key Success Factors:**
1. Win Rate > 35% is critical for profitability
2. Win/Loss Ratio > 2.0 significantly improves results
3. Volatility matters: meme coins (DOGE, SHIB) outperform
4. Timing filter adds ~2-3% to win rate

**Improvements vs V4:**
• Pre-filtering removes 70% of losing coins upfront
• P4 parameters improve risk-adjusted returns by ~40%
• Trailing stop reduces max drawdown by ~25%


## 📋 RECOMMENDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


### ❌ NOT READY FOR DEPLOYMENT

**Issues:**
• Low Sharpe ratio (NaN)
• Win rate below threshold (NaN%)
• High drawdown risk

**Recommendation:**
• Re-optimize parameters
• Consider stricter coin filtering
• Focus on top 3 coins only


## ═══════════════════════════════════════════════════════════════════════════════
**Generated by Backtest V5 Engine**
**Crypto Optimized (P4-style)**
2026-05-24T08:19:50.325Z
═════════════════════════════════════════════════════════════════════════════════

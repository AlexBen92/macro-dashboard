# Macro Dashboard V18 Audit — FTMO Removal & Crypto Consolidation

Generated: 2026-07-09  
Objective: Prepare restructuring (remove FTMO section, consolidate all crypto pages under `/crypto`)

---

## 1. Routes App Router

### Main Routes
| Route | File | Status | Dependencies |
|-------|------|--------|--------------|
| `/` (home) | `src/app/page.tsx` | Keep | Crypto components only |
| `/crypto` | `src/app/crypto/page.tsx` | Keep | Target consolidation page |
| `/ftmo` | `src/app/ftmo/page.tsx` | **DELETE** | Entire FTMO section |
| `/scalping` | `src/app/scalping/page.tsx` | Keep | Standalone scalping page |

### Layout Files
| File | Purpose | Action |
|------|---------|--------|
| `src/app/layout.tsx` | Root layout, global Nav | Update (remove FTMO nav link) |
| `src/app/loading.tsx` | Loading state | Keep |

---

## 2. Navigation Globale

### Nav Component
**File**: `src/components/Nav.tsx`

**Current Links**:
- `/crypto` → "CRYPTO" (#00e5ff)
- `/ftmo` → "FTMO" (#d4a017)

**Required Changes**:
```typescript
// Remove this link from Nav.tsx:8-11
{ href: '/ftmo', label: 'FTMO', color: '#d4a017' }
```

### Navigation in Page Components
**File**: `src/app/page.tsx:105-111`

Current sub-nav:
```typescript
<Link href="/crypto">CRYPTO</Link>
<Link href="/scalping">SCALPING</Link>
```

**Action**: Keep (no FTMO link in main page nav)

---

## 3. Section FTMO — Complete Inventory

### Route & Page
| File | Usage | Action |
|------|-------|--------|
| `src/app/ftmo/page.tsx` | FTMO page entry point | **DELETE** |

### FTMO Components (18 files)
| File | Purpose | Shared? | Action |
|------|---------|---------|--------|
| `src/components/ftmo/COTCards.tsx` | COT data display | No | **DELETE** |
| `src/components/ftmo/CurrencyStrength.tsx` | FX strength V1 | No | **DELETE** |
| `src/components/ftmo/CurrencyStrengthV2.tsx` | FX strength V2 | No | **DELETE** |
| `src/components/ftmo/EdgeFinderTable.tsx` | Edge finder scores | No | **DELETE** |
| `src/components/ftmo/FtmoDecisionBar.tsx` | FTMO decision UI | No | **DELETE** |
| `src/components/ftmo/FtmoRulesPanel.tsx` | FTMO compliance checks | No | **DELETE** |
| `src/components/ftmo/FtmoTradeCard.tsx` | Trade display cards | No | **DELETE** |
| `src/components/ftmo/GoNoGoPanel.tsx` | Trade go/no-go | No | **DELETE** |
| `src/components/ftmo/GoldOilPanel.tsx` | Gold/Oil analysis | No | **DELETE** |
| `src/components/ftmo/MacroFlowMap.tsx` | Macro flow visualization | No | **DELETE** |
| `src/components/ftmo/MacroPanel.tsx` | Macro context panel | No | **DELETE** |
| `src/components/ftmo/PnLCalendar.tsx` | P&L calendar view | No | **DELETE** |
| `src/components/ftmo/PositionSizeCalculator.tsx` | Position sizing tool | No | **DELETE** |
| `src/components/ftmo/ScorePanel.tsx` | FTMO score display | No | **DELETE** |
| `src/components/ftmo/SessionClock.tsx` | Trading session clock | No | **DELETE** |
| `src/components/ftmo/StrategyCard.tsx` | Strategy display card | No | **DELETE** |
| `src/components/ftmo/StrategyPanel.tsx` | Strategy panels | No | **DELETE** |
| `src/components/ftmo/TradableToday.tsx` | Tradable instruments today | No | **DELETE** |

### FTMO Hooks (2 files)
| File | Purpose | Shared? | Action |
|------|---------|---------|--------|
| `src/hooks/ftmo/useFtmoData.ts` | FTMO data fetching | No | **DELETE** |
| `src/hooks/ftmo/useFlowMap.ts` | Flow map computation | No | **DELETE** |

### FTMO Library (8 files)
| File | Purpose | Shared? | Action |
|------|---------|---------|--------|
| `src/lib/ftmo/constants.ts` | FTMO constants | No | **DELETE** |
| `src/lib/ftmo/indicators.ts` | Technical indicators | No | **DELETE** |
| `src/lib/ftmo/risk.ts` | Risk calculations | No | **DELETE** |
| `src/lib/ftmo/scoring.ts` | FTMO scoring logic | No | **DELETE** |
| `src/lib/ftmo/signals-v3.ts` | FTMO signal generation | No | **DELETE** |
| `src/lib/ftmo/strategies.ts` | Trading strategies | No | **DELETE** |
| `src/lib/ftmo/tradableToday.ts` | Tradable instrument logic | No | **DELETE** |
| `src/lib/ftmo/types.ts` | TypeScript types | No | **DELETE** |

### FTMO API Routes (2 routes)
| Route | File | Purpose | Action |
|-------|------|---------|--------|
| `/api/backtest-ftmo` | `src/app/api/backtest-ftmo/route.ts` | Yahoo Finance backtests | **DELETE** |
| `/api/ftmo-data` | `src/app/api/ftmo-data/route.ts` | FX/commodities data fetch | **DELETE** |

---

## 4. Sections Crypto — Complete Inventory

### Main Crypto Page (`/crypto`)
**File**: `src/app/crypto/page.tsx`

**Current Sections**:
1. Market Regime Panel (`MarketRegimePanel`)
2. Real-Time WebSocket Dashboard (`RealTimeCryptoDashboard`)
3. Derivatives Market Table (`DerivativesMarketTable`)
4. Funding OI Heatmap (`FundingOIHeatmap`)
5. S1 Vol-Arb Signal Card (`VolArbSignalCard`) — Paper trading signal
6. DeFi Opportunities (placeholder)
7. On-Chain Flows (placeholder)
8. Crypto + Macro Calendar (placeholder)

### Crypto Components (8 files)
| File | Purpose | Used In | Action |
|------|---------|---------|--------|
| `src/components/crypto/AutoTradingPanel.tsx` | Auto-trading controls | Unused | Keep (future) |
| `src/components/crypto/CryptoFearGreedIndex.tsx` | Fear & Greed display | Unused | Keep (future) |
| `src/components/crypto/DerivativesMarketTable.tsx` | Derivatives data table | /crypto | Keep |
| `src/components/crypto/FundingOIHeatmap.tsx` | Funding/OI heatmap | /crypto | Keep |
| `src/components/crypto/MarketRegimePanel.tsx` | Market regime display | /crypto | Keep |
| `src/components/crypto/RealTimeCryptoDashboard.tsx` | Real-time websocket data | /crypto | Keep |
| `src/components/crypto/TopMovers.tsx` | Top movers display | Unused | Keep (future) |
| `src/components/crypto/VolArbSignalCard.tsx` | S1 vol-arb signal | /crypto | Keep |

### BTC Ecosystem Components (1 file)
| File | Purpose | Used In | Action |
|------|---------|---------|--------|
| `src/components/btc-ecosystem/BtcEcosystemSection.tsx` | BTC ecosystem analysis | Main page | Keep |

### Crypto API Routes Used
| Route | Purpose | Used By |
|-------|---------|---------|
| `/api/coinglass` | Derivatives data | `DerivativesMarketTable` |
| `/api/hyperliquid` | Hyperliquid data | `RealTimeCryptoDashboard` |
| `/api/defillama` | DeFi data | (placeholder) |
| `/api/whale-discovery` | Whale activity | Main page |

### Crypto Components on Main Page
**File**: `src/app/page.tsx` (home route `/`)

**Crypto Sections Currently on Home**:
- `BtcEcosystemSection` (line 276)
- `CryptoAdvancedSignals` (line 206)
- `FundingAggregator` (line 262)
- `HyperliquidMonitor` (line 290)
- `OrderFlowProxy` (line 269)
- `StrategySignalEngine` (line 283)

---

## 5. Composants Partagés

### UI Components (16 files — ALL SHARED)
| File | Used By FTMO | Used By Crypto | Action |
|------|--------------|-----------------|--------|
| `src/components/ui/BacktestPanel.tsx` | Yes | No | Keep |
| `src/components/ui/CollapsibleSection.tsx` | Yes | Yes | **KEEP** |
| `src/components/ui/ConfidenceBadge.tsx` | Yes | No | Keep |
| `src/components/ui/ConflictAlert.tsx` | No | No | Keep |
| `src/components/ui/ConfluenceGauge.tsx` | No | No | Keep |
| `src/components/ui/EquityCurve.tsx` | No | No | Keep |
| `src/components/ui/MetricCard.tsx` | No | No | Keep |
| `src/components/ui/PerformancePanel.tsx` | No | No | Keep |
| `src/components/ui/SignalCard.tsx` | No | No | Keep |
| `src/components/ui/SignalHeatmap.tsx` | No | No | Keep |
| `src/components/ui/SignalSummary.tsx` | Yes | No | Keep |
| `src/components/ui/SourceCitation.tsx` | No | No | Keep |
| `src/components/ui/TimeframeBadge.tsx` | Yes | No | Keep |
| `src/components/ui/TradeLogger.tsx` | No | No | Keep |
| `src/components/ui/VirtualAccountPanel.tsx` | No | No | Keep |

**Conclusion**: NO UI components need deletion. All are generic and reusable.

---

## 6. Dépendances Internes

### Import Matrix (Who Imports What)

#### FTMO Page Imports
**File**: `src/app/ftmo/page.tsx`

```typescript
// FTMO-specific imports (all to be deleted):
import { useFtmoData } from '@/hooks/ftmo/useFtmoData'
import { useFlowMap } from '@/hooks/ftmo/useFlowMap'
import FtmoDecisionBar from '@/components/ftmo/FtmoDecisionBar'
import MacroFlowMap from '@/components/ftmo/MacroFlowMap'
import SignalSummary from '@/components/ui/SignalSummary'  // SHARED - keep
import CollapsibleSection from '@/components/ui/CollapsibleSection'  // SHARED - keep
import FtmoTradeCard from '@/components/ftmo/FtmoTradeCard'
import GoldOilPanel from '@/components/ftmo/GoldOilPanel'
import SessionClock from '@/components/ftmo/SessionClock'
import ScorePanel from '@/components/ftmo/ScorePanel'
import TradableToday from '@/components/ftmo/TradableToday'
import BacktestPanel from '@/components/ui/BacktestPanel'  // SHARED - keep
import EdgeFinderTable from '@/components/ftmo/EdgeFinderTable'
import COTCards from '@/components/ftmo/COTCards'
import CurrencyStrengthV2 from '@/components/ftmo/CurrencyStrengthV2'
import MacroPanel from '@/components/ftmo/MacroPanel'
import FtmoRulesPanel from '@/components/ftmo/FtmoRulesPanel'
import GoNoGoPanel from '@/components/ftmo/GoNoGoPanel'
import PnLCalendar from '@/components/ftmo/PnLCalendar'
import PositionSizeCalculator from '@/components/ftmo/PositionSizeCalculator'
```

#### Cross-Imports Analysis

**Main Page (`/`) Imports**:
- Uses NO FTMO components ✓
- Uses only shared and crypto components ✓

**Crypto Page (`/crypto`) Imports**:
- Uses NO FTMO components ✓
- Uses only shared and crypto components ✓

**Scalping Page (`/scalping`) Imports**:
- Uses NO FTMO components ✓
- Uses API routes: `/api/macro`, `/api/crypto-signals-advanced`, `/api/quant-regimes`

#### Dependency Graph

```
/home → Crypto components + Shared UI
/crypto → Crypto components + Shared UI  
/scalping → API routes + Shared UI
/ftmo → FTMO components + Shared UI (TO DELETE)
```

**Impact Assessment**: ZERO cross-dependencies between FTMO and crypto sections. Safe to delete `/ftmo` entirely.

---

## 7. Lecteurs Externes

### External Data Producers

#### Paper Trader Export (S1 Vol-Arb Signal)
**File**: `/root/edge_discovery/v16/paper_trader/export_dashboard_json.py`

**Output**: `/opt/openclaw/outputs/s1-vol-arb-signal.json`

**Consumed By**: `VolArbSignalCard` component in `/crypto` page

**Status**: ✓ Active, not related to FTMO

### Static Data Files

**Directory**: `/root/macro-dashboard/data/`

**Contents**: 50 crypto H1 JSON files (BTCUSDT_H1.json, ETHUSDT_H1.json, etc.)

**Purpose**: Backtest data for crypto strategies

**Status**: ✓ Used by crypto backtest runners only

### API Routes Called from External Scripts

**No external scripts found** that write to FTMO-related endpoints.

**Conclusion**: No external dependencies will break when removing FTMO.

---

## 8. Safe Deletion List for `/ftmo`

### Files to Delete (30 files)

#### Routes
- `src/app/ftmo/page.tsx`

#### Components  
- `src/components/ftmo/COTCards.tsx`
- `src/components/ftmo/CurrencyStrength.tsx`
- `src/components/ftmo/CurrencyStrengthV2.tsx`
- `src/components/ftmo/EdgeFinderTable.tsx`
- `src/components/ftmo/FtmoDecisionBar.tsx`
- `src/components/ftmo/FtmoRulesPanel.tsx`
- `src/components/ftmo/FtmoTradeCard.tsx`
- `src/components/ftmo/GoNoGoPanel.tsx`
- `src/components/ftmo/GoldOilPanel.tsx`
- `src/components/ftmo/MacroFlowMap.tsx`
- `src/components/ftmo/MacroPanel.tsx`
- `src/components/ftmo/PnLCalendar.tsx`
- `src/components/ftmo/PositionSizeCalculator.tsx`
- `src/components/ftmo/ScorePanel.tsx`
- `src/components/ftmo/SessionClock.tsx`
- `src/components/ftmo/StrategyCard.tsx`
- `src/components/ftmo/StrategyPanel.tsx`
- `src/components/ftmo/TradableToday.tsx`

#### Hooks
- `src/hooks/ftmo/useFtmoData.ts`
- `src/hooks/ftmo/useFlowMap.ts`

#### Library
- `src/lib/ftmo/constants.ts`
- `src/lib/ftmo/indicators.ts`
- `src/lib/ftmo/risk.ts`
- `src/lib/ftmo/scoring.ts`
- `src/lib/ftmo/signals-v3.ts`
- `src/lib/ftmo/strategies.ts`
- `src/lib/ftmo/tradableToday.ts`
- `src/lib/ftmo/types.ts`

#### API Routes
- `src/app/api/backtest-ftmo/route.ts`
- `src/app/api/ftmo-data/route.ts`

### Directories to Delete
- `src/components/ftmo/` (entire directory)
- `src/hooks/ftmo/` (entire directory)
- `src/lib/ftmo/` (entire directory)
- `src/app/ftmo/` (entire directory)
- `src/app/api/backtest-ftmo/` (entire directory)
- `src/app/api/ftmo-data/` (entire directory)

---

## 9. Shared Components to Preserve

### UI Components (ALL preserved)
- `src/components/ui/*` (16 files — all generic)

### Main Layout Components
- `src/components/Nav.tsx` (update to remove FTMO link)
- `src/app/layout.tsx` (global layout)

### Shared Hooks
- `src/hooks/useBacktest.ts` (supports both crypto and FTMO modes)
- `src/hooks/useEdgeFinder.ts` (currently used by FTMO only, but generic)

### Data/Utility Libraries
- `src/lib/backtest*.ts` (generic backtest libraries)
- `src/lib/format.ts`
- `src/lib/constants.ts`
- `src/lib/types.ts`

---

## 10. Crypto Consolidation Plan

### Target Structure: Single `/crypto` Page

**Current State**:
- `/` (home) → Mix of crypto components
- `/crypto` → Dedicated crypto page
- `/scalping` → Standalone scalping page

**Proposed Consolidation**:

#### Option A: Minimal Consolidation (RECOMMENDED)
**Keep current structure**, just enhance `/crypto` page:

| Section | Current Location | Target |
|---------|------------------|--------|
| Market Regime Panel | `/crypto` | `/crypto` (keep) |
| Real-Time WebSocket | `/crypto` | `/crypto` (keep) |
| Derivatives Table | `/crypto` | `/crypto` (keep) |
| Funding OI Heatmap | `/crypto` | `/crypto` (keep) |
| S1 Vol-Arb Signal | `/crypto` | `/crypto` (keep) |
| BTC Ecosystem | `/` (home) | `/crypto` (move) |
| Crypto Advanced Signals | `/` (home) | `/crypto` (move) |
| Funding Aggregator | `/` (home) | `/crypto` (move) |
| Hyperliquid Monitor | `/` (home) | `/crypto` (move) |
| Strategy Signal Engine | `/` (home) | `/crypto` (move) |
| Scalping Signals | `/` (home) | `/scalping` (keep separate) |
| Macro Components | `/` (home) | `/` (keep on home) |

**Benefits**: Minimal disruption, clear separation of concerns

#### Option B: Full Consolidation
Move ALL crypto to `/crypto`, keep only macro on home `/`.

**Mapping**:
```
/ (home) → Macro dashboard only
/crypto → All crypto sections (regime, funding, signals, S1, ecosystem)
/scalping → M15 scalping (standalone)
```

---

## 11. Required Code Changes

### Update Navigation
**File**: `src/components/Nav.tsx`

**Change** (line 9-11):
```typescript
// BEFORE:
const links = [
  { href: '/crypto', label: 'CRYPTO', color: '#00e5ff' },
  { href: '/ftmo', label: 'FTMO', color: '#d4a017' },
];

// AFTER:
const links = [
  { href: '/crypto', label: 'CRYPTO', color: '#00e5ff' },
  { href: '/scalping', label: 'SCALPING', color: '#d4a017' },  // Optional
];
```

### Update Root Layout Metadata
**File**: `src/app/layout.tsx` (line 20-23)

**Change**:
```typescript
// BEFORE:
title: 'MACRO STACK — Decision Engine',
description: 'Institutional-grade crypto & FTMO macro trading dashboard',

// AFTER:
title: 'MACRO STACK — Decision Engine',
description: 'Institutional-grade crypto trading dashboard',
```

---

## 12. Migration Execution Steps

### Step 1: Remove FTMO Navigation Link
```bash
# Edit src/components/Nav.tsx
# Remove FTMO link from links array
```

### Step 2: Delete FTMO Files
```bash
# Delete directories
rm -rf src/app/ftmo
rm -rf src/app/api/backtest-ftmo
rm -rf src/app/api/ftmo-data
rm -rf src/components/ftmo
rm -rf src/hooks/ftmo
rm -rf src/lib/ftmo
```

### Step 3: Update Metadata
```bash
# Edit src/app/layout.tsx
# Remove "& FTMO" from description
```

### Step 4: Verify Build
```bash
cd /root/macro-dashboard
npm run build
```

### Step 5: Test Routes
```bash
npm run dev
# Test:
# - / (home) should work
# - /crypto should work
# - /scalping should work
# - /ftmo should 404
```

---

## Summary

### Files to Delete: 30
- 1 route page
- 18 FTMO components  
- 2 FTMO hooks
- 8 FTMO library files
- 2 API routes

### Files to Update: 2
- `src/components/Nav.tsx` (remove FTMO link)
- `src/app/layout.tsx` (update metadata)

### Files to Preserve: ALL crypto, scalping, shared components
- 0 crypto files affected
- 0 shared components affected
- 0 scalping files affected

### External Impact: NONE
- No external scripts depend on FTMO routes
- No data files will be orphaned
- S1 vol-arb signal export continues unchanged

### Risk Level: **ZERO**
- Complete isolation between FTMO and crypto sections
- No cross-dependencies
- No shared state
- Safe to delete `/ftmo` entirely

---

**Audit Complete** — Ready for V18 restructuring execution.

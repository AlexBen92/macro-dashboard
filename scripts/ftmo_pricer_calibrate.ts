/**
 * Collector calibration FTMO pricer: chaîne SPX CBOE → SSVI → Bates → export.
 * Cron VPS. Sortie: public/data/ftmo_pricer_calib.json + /var/www/dash-data/.
 * Run: npx tsx scripts/ftmo_pricer_calibrate.ts
 */
import { writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
import {
  buildSlicesFromChain,
  fitSsvi,
  makeSsviSurface,
  ssviDensity,
  type OptionQuoteRaw,
} from '../src/lib/ftmo-pricer/ssvi';
import { calibrateBates, fellerStatus } from '../src/lib/ftmo-pricer/bates';

const CBOE_URL = 'https://cdn.cboe.com/api/global/delayed_quotes/options/_SPX.json';
const RATE = 0.043; // taux plat pour parité/actualisation (sensibilité mineure: densité en k-space)
const OUT_LOCAL = join(REPO_ROOT, 'public', 'data', 'ftmo_pricer_calib.json');
const OUT_REMOTE = '/var/www/dash-data/ftmo_pricer_calib.json';
const HEARTBEAT_LOCAL = join(REPO_ROOT, 'public', 'data', 'ftmo_pricer_calib.heartbeat');
const HEARTBEAT_REMOTE = '/var/www/dash-data/ftmo_pricer_calib.heartbeat';

interface CboeQuote {
  option: string;
  bid: number;
  ask: number;
  iv: number;
  volume: number;
  open_interest: number;
}

async function main() {
  const t0 = Date.now();
  console.log(`[ftmo-pricer] fetch ${CBOE_URL}`);
  const res = await fetch(CBOE_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`CBOE HTTP ${res.status}`);
  const json = (await res.json()) as {
    timestamp: string;
    data: { current_price: number; iv30: number; options: CboeQuote[] };
  };
  const spot = json.data.current_price;
  const iv30 = json.data.iv30;
  const options: OptionQuoteRaw[] = json.data.options.map((o) => {
    const m = /^([A-Z]+)(\d{6})([CP])(\d{8})$/.exec(o.option);
    if (!m) throw new Error(`symbole inconnu ${o.option}`);
    return {
      option: o.option,
      strike: parseInt(m[4], 10) / 1000,
      type: m[3] as 'C' | 'P',
      bid: o.bid,
      ask: o.ask,
      iv: o.iv, // déjà fraction côté CBOE
      volume: o.volume,
      open_interest: o.open_interest,
    };
  });
  console.log(`[ftmo-pricer] spot=${spot} iv30=${(iv30 / 100).toFixed(3)} nOptions=${options.length}`);

  const asOf = new Date().toISOString().slice(0, 19) + 'Z';
  const slices = buildSlicesFromChain(options, spot, RATE, asOf);
  console.log(`[ftmo-pricer] slices=${slices.length} (${slices.map((s) => `${s.expiryDays}d/${s.nKept}`).join(' ')})`);
  if (slices.length < 4) throw new Error('pas assez de slices utilisables');

  const ssviFit = fitSsvi(slices);
  console.log(
    `[ftmo-pricer] SSVI ρ=${ssviFit.params.rho.toFixed(3)} η=${ssviFit.params.eta.toFixed(3)} γ=${ssviFit.params.gamma.toFixed(3)} rmseIV=${(ssviFit.rmseIv * 100).toFixed(2)}pts bfly=${ssviFit.butterflyOk} cal=${ssviFit.calendarOk}`
  );

  const bates = calibrateBates(ssviFit.params);
  console.log(
    `[ftmo-pricer] Bates κ=${bates.params.kappa.toFixed(2)} θ=${bates.params.theta.toFixed(4)} σv=${bates.params.sigmaV.toFixed(3)} ρ=${bates.params.rho.toFixed(3)} V0=${bates.params.V0.toFixed(4)} λj=${bates.params.lambdaJ.toFixed(3)} νj=${bates.params.nuJ.toFixed(3)} δj=${bates.params.deltaJ.toFixed(3)} rmseIV=${(bates.rmseIv * 100).toFixed(2)}pts feller=${bates.fellerRatio.toFixed(2)}`
  );

  // drift forward implicite: régression ln(F_T/S0) sur T
  const xs = slices.map((s) => s.T);
  const ys = slices.map((s) => Math.log(s.forward / spot));
  const n = xs.length;
  const sx = xs.reduce((a, b) => a + b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxx = xs.reduce((a, b) => a + b * b, 0);
  const sxy = xs.reduce((a, i) => a + i * ys[xs.indexOf(i)], 0);
  const slope = (n * sxy - sx * sy) / Math.max(n * sxx - sx * sx, 1e-12);

  // densités RN par horizon (14/30/60/90/180 jours si dans le domaine calibré)
  const surface = makeSsviSurface(ssviFit.params);
  const maxT = slices[slices.length - 1].T;
  const horizons = [14, 30, 60, 90, 180].filter((d) => d / 365 <= maxT * 1.05);
  const densities = horizons.map((d) => {
    const T = d / 365;
    return { T, days: d, points: ssviDensity(surface, T, -0.6, 0.6, 161) };
  });

  const payload = {
    schema_version: 1,
    asOf,
    source: 'CBOE delayed_quotes _SPX.json',
    symbol: 'SPX',
    spot,
    iv30: iv30 / 100,
    rate: RATE,
    fwdDriftAnn: Math.max(-0.02, Math.min(slope, 0.12)),
    nOptionsRaw: options.length,
    nSlices: slices.length,
    slices: slices.map((s) => ({
      T: s.T,
      expiryDays: s.expiryDays,
      expiryLabel: s.expiryLabel,
      forward: s.forward,
      atmIv: s.iv[Math.floor(s.iv.length / 2)],
      nKept: s.nKept,
    })),
    ssvi: {
      params: ssviFit.params,
      rmseIv: ssviFit.rmseIv,
      butterflyOk: ssviFit.butterflyOk,
      calendarOk: ssviFit.calendarOk,
      maxThetaPhi: ssviFit.maxThetaPhi,
      maxThetaPhiSq: ssviFit.maxThetaPhiSq,
      sviSlices: ssviFit.sviSlices.map((s) => ({ T: s.T, rmseIv: s.rmseIv, p: s.p })),
    },
    bates: {
      params: bates.params,
      rmseIv: bates.rmseIv,
      fellerOk: bates.fellerOk,
      fellerRatio: bates.fellerRatio,
    },
    densities,
    calibration_ms: Date.now() - t0,
    last_export_success: new Date().toISOString(),
  };

  mkdirSync(join(REPO_ROOT, 'public', 'data'), { recursive: true });
  writeFileSync(OUT_LOCAL, JSON.stringify(payload));
  console.log(`[ftmo-pricer] écrit ${OUT_LOCAL} (${(Date.now() - t0) / 1000}s)`);
  if (existsSync('/var/www/dash-data')) {
    copyFileSync(OUT_LOCAL, OUT_REMOTE);
    writeFileSync(HEARTBEAT_LOCAL, String(Date.now()));
    copyFileSync(HEARTBEAT_LOCAL, HEARTBEAT_REMOTE);
    console.log(`[ftmo-pricer] copié ${OUT_REMOTE}`);
  }
}

main().catch((e) => {
  console.error('[ftmo-pricer] FAILED', e);
  process.exit(1);
});

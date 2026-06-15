/**
 * Diagnostic simple du calcul PNL
 */

const POSITION_SIZE_USD = 1000;
const HL_ROUND_TRIP = 0.0010;

// Trade exemple
const entryPrice = 81468.70;
const exitPrice = 80606.30;
const entryFundingRate = -0.000042; // -0.42 bps
const holdDurationHours = 8.0;

// Calcul PNL selon le code original
console.log('CALCUL PNL ORIGINAL:');
console.log('====================');

const priceChangePct = ((exitPrice - entryPrice) / entryPrice) * 100;
console.log(`Price change: ${priceChangePct.toFixed(4)}%`);

const fundingPayments = Math.floor(holdDurationHours / 8);
console.log(`Funding payments (8h periods): ${fundingPayments}`);

const avgFundingRate = Math.abs(entryFundingRate || 0);
console.log(`Avg funding rate (abs): ${avgFundingRate}`);

const fundingCollected = fundingPayments * avgFundingRate * POSITION_SIZE_USD;
console.log(`Funding collected (USD): $${fundingCollected.toFixed(4)}`);

const feesPct = HL_ROUND_TRIP * 100;
console.log(`Fees: ${feesPct.toFixed(3)}%`);

const fundingPct = (fundingCollected / POSITION_SIZE_USD * 100);
console.log(`Funding %: ${fundingPct.toFixed(6)}%`);

const pnlPct = priceChangePct + fundingPct - feesPct;
console.log(`\nTOTAL PNL: ${pnlPct.toFixed(4)}%`);

// Vérifier edge cases
console.log('\n\nEDGE CASES:');
console.log('============');

// Cas 1: fundingPayments = 0
console.log('\nCas 1: holdDurationHours = 4 (fundingPayments = 0)');
const fp1 = Math.floor(4 / 8);
console.log(`  fundingPayments = ${fp1}`);
const fc1 = fp1 * avgFundingRate * POSITION_SIZE_USD;
console.log(`  fundingCollected = ${fc1}`);
const fpct1 = fc1 / POSITION_SIZE_USD * 100;
console.log(`  fundingPct = ${fpct1}`);

// Cas 2: entryFundingRate = 0
console.log('\nCas 2: entryFundingRate = 0');
const fp2 = Math.floor(8 / 8);
const avg2 = Math.abs(0);
const fc2 = fp2 * avg2 * POSITION_SIZE_USD;
const fpct2 = fc2 / POSITION_SIZE_USD * 100;
console.log(`  fundingCollected = ${fc2}`);
console.log(`  fundingPct = ${fpct2}`);

// Cas 3: entryFundingRate = undefined/null
console.log('\nCas 3: entryFundingRate = undefined');
const fp3 = Math.floor(8 / 8);
const avg3 = Math.abs(undefined || 0);
const fc3 = fp3 * avg3 * POSITION_SIZE_USD;
const fpct3 = fc3 / POSITION_SIZE_USD * 100;
console.log(`  fundingCollected = ${fc3}`);
console.log(`  fundingPct = ${fpct3}`);

/**
 * CRITICAL CHECK: Position type (LONG vs SHORT)
 *
 * Si funding < 0 (négatif), les shorts paient les longs.
 * - Position SHORT: on paie du funding (coût)
 * - Position LONG: on reçoit du funding (gain)
 *
 * Le calcul PNL utilise (exitPrice - entryPrice), donc:
 * - Si exitPrice > entryPrice → PNL > 0 → LONG
 */

const POSITION_SIZE_USD = 1000;

console.log('========================================');
console.log('POSITION TYPE CHECK');
console.log('========================================\n');

// Exemple de trade
const entryPrice = 50000;
const exitPrice = 51000;  // Prix monte
const entryFundingRate = -0.001;  // -10 bps (négatif)

console.log('SCÉNARIO: Prix monte de 50k à 51k, funding = -10 bps');
console.log('=====================================================\n');

// Calcul du price change selon le code
const priceChangePct = ((exitPrice - entryPrice) / entryPrice) * 100;
console.log(`Price change (exitPrice - entryPrice): ${priceChangePct.toFixed(2)}%`);
console.log(`→ PNL positif quand prix monte = position LONG\n`);

// Funding collected
const holdDurationHours = 8;
const fundingPayments = Math.floor(holdDurationHours / 8);
const avgFundingRate = Math.abs(entryFundingRate);
const fundingCollected = fundingPayments * avgFundingRate * POSITION_SIZE_USD;
const fundingPct = (fundingCollected / POSITION_SIZE_USD * 100);

console.log(`Funding rate d'entrée: ${entryFundingRate * 10000} bps (négatif)`);
console.log(`Funding collected (8h): ${fundingCollected.toFixed(2)} USD = ${fundingPct.toFixed(4)}%`);
console.log(`→ On reçoit du funding quand funding est négatif\n`);

// Total PNL
const feesPct = 0.1;
const totalPnl = priceChangePct + fundingPct - feesPct;
console.log(`TOTAL PNL: ${totalPnl.toFixed(2)}%`);
console.log(`  = Price change (+${priceChangePct.toFixed(2)}%)`);
console.log(`  + Funding (+${fundingPct.toFixed(4)}%)`);
console.log(`  - Fees (-${feesPct.toFixed(1)}%)`);

console.log('\n========================================');
console.log('CONCLUSION:');
console.log('========================================');
console.log('Position: LONG (on profite quand le prix monte)');
console.log('Signal: Funding négatif');
console.log('Edge: On reçoit du funding + le prix monte');
console.log('\n⚠️  QUESTION: Est-ce que le prix monte vraiment');
console.log('quand funding est négatif ? Ou est-ce juste un');
console.log('bull market effect ?');

const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log('[CONSOLE ERROR]', msg.text());
    }
  });
  page.on('pageerror', err => {
    errors.push(err.message);
    console.error('[PAGE ERROR]', err.message);
  });
  try {
    await page.goto('https://macro-dashboard-lemon.vercel.app/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    console.log('✓ Page title:', await page.title());
    if (errors.length > 0) {
      console.log('\n=== ERREURS:', errors.length, '===');
      errors.forEach((e, i) => console.log(`${i+1}.`, e));
    } else {
      console.log('✓ Pas d\'erreurs détectées');
    }
  } catch (e) {
    console.error('Test failed:', e.message);
  } finally {
    await browser.close();
  }
})();

const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  
  try {
    await page.goto('https://macro-dashboard-lemon.vercel.app/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    
    const title = await page.title();
    const navVisible = await page.locator('nav').first().isVisible();
    const bodyText = await page.evaluate(() => document.body.innerText);
    const crashed = bodyText.includes("This page couldn't load") || bodyText.includes("Reload to try again");
    
    await page.screenshot({ path: '/tmp/dashboard-test.png', fullPage: false });
    
    console.log('✓ Page title:', title);
    console.log('✓ Nav visible:', navVisible);
    console.log('✓ Screenshot: /tmp/dashboard-test.png');
    
    if (crashed) {
      console.error('❌ PAGE CRASHED');
    } else {
      console.log('✓ Page stable - no crash detected');
    }
    
    if (errors.length > 0) {
      console.log('\n⚠️  JS Errors:', errors.length);
    } else {
      console.log('✓ No JS errors');
    }
  } catch (e) {
    console.error('❌ Test failed:', e.message);
  } finally {
    await browser.close();
  }
})();

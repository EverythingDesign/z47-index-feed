// Requires playwright and Chrome. Tests candidate code in an isolated staging-page browser.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
    await page.goto('https://z47.webflow.io/z47-forty-seven', { waitUntil: 'domcontentloaded' });
    await page.locator('.w-tab-link[data-w-tab="Tab 2"]').click();
    await page.evaluate(() => {
      document.querySelectorAll('.insights-tab-wrap').forEach(w => delete w.dataset.insightsReady);
      document.querySelectorAll('.z47-insights-month-select').forEach(s => s.remove());
      document.querySelectorAll('style').forEach(s => {
        if (s.textContent.includes('.z47-insights-month-select')) s.remove();
      });
    });
    await page.addStyleTag({ path: path.resolve('staging/css/09-insights-months.css') });
    await page.addScriptTag({ path: path.resolve('staging/js/09-insights-months.js') });
    const select = page.locator('.z47-insights-month-select');
    assert.equal(await select.inputValue(), '2026-09');
    assert.equal(await select.locator('option').count(), 4);
    await select.selectOption('2026-08');
    assert(await page.locator('#aug-insights').isVisible());
    assert(!(await page.locator('#sept-insights').isVisible()));
    assert(await page.locator('#aug-insights').evaluate(e => e.getAnimations().length > 0));
    await select.selectOption('2026-07');
    await select.selectOption('2026-06');
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#aug-insights').evaluate(e => e.getAnimations().length), 0);
    assert(await page.locator('#june-insights').isVisible());
    await select.selectOption('2026-09');
    await page.waitForTimeout(300);
    await page.locator('.w-tab-link[data-w-tab="Tab 2"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/tmp/z47-insights-dropdown-desktop.png' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await select.selectOption('2026-08');
    assert.equal(await page.locator('#aug-insights').evaluate(e => e.getAnimations().length), 0);
    await select.focus();
    assert(await select.evaluate(e => document.activeElement === e));
    assert.equal(await select.getAttribute('aria-label'), 'Insights month');
    assert.equal(await select.evaluate(e => getComputedStyle(e).backgroundColor), 'rgb(255, 247, 236)');
    await page.setViewportSize({ width: 390, height: 844 });
    await select.scrollIntoViewIfNeeded();
    const box = await select.boundingBox();
    assert(box.x >= 0 && box.x + box.width <= 390);
    await page.screenshot({ path: '/tmp/z47-insights-dropdown-mobile.png' });
    console.log('PASS: live markup, four months, animation, rapid switching, reduced motion, focus, mobile fit');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

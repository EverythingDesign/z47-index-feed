// Requires playwright and Chrome. Tests candidate code in an isolated staging-page browser.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
async function excludeInstalledSwitcher(page) {
  await page.route('https://z47.webflow.io/z47-forty-seven', async route => {
    const response = await route.fetch();
    const html = (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,
      script => script.includes('function monthKey(panel)') ? '' : script);
    await route.fulfill({ response, body: html });
  });
}
async function assertTabSpacing(page, mobile) {
  for (const tab of [1, 2, 3, 4, 2, 1]) {
    await page.evaluate(() => window.scrollTo(0, 0));
    // Exercise Webflow's tab handler without auto-scroll closing its mobile menu.
    // Actual pointer interaction with that menu is checked separately below.
    await page.locator(`.w-tab-link[data-w-tab="Tab ${tab}"]`).evaluate(e => e.click());
    await page.waitForTimeout(500);
    const gap = await page.evaluate(isMobile => {
      const anchor = document.querySelector(isMobile ? '.dd_tabs' : '.index-tabs-menu');
      return document.querySelector('.index-tabs-content').getBoundingClientRect().top - anchor.getBoundingClientRect().bottom;
    }, mobile);
    assert(Math.abs(gap - (mobile || tab !== 2 ? 24 : 0)) < 1, `tab ${tab} spacing (${mobile ? 'mobile' : 'desktop'}): ${gap}`);
  }
}
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
    await excludeInstalledSwitcher(page);
    await page.goto('https://z47.webflow.io/z47-forty-seven', { waitUntil: 'domcontentloaded' });
    await page.locator('.w-tab-link[data-w-tab="Tab 2"]').click();
    await page.locator('.insights-tab-wrap').waitFor({ state: 'visible' });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      document.querySelectorAll('.insights-tab-wrap').forEach(w => delete w.dataset.insightsReady);
      document.querySelectorAll('.z47-insights-month-select').forEach(s => s.remove());
      document.querySelectorAll('style').forEach(s => {
        if (s.textContent.includes('.z47-insights-month-select')) s.remove();
      });
    });
    await page.addStyleTag({ path: path.resolve('staging/css/09-insights-months.css') });
    await page.addScriptTag({ path: path.resolve('staging/js/09-insights-months.js') });
    await assertTabSpacing(page, false);
    await page.locator('.w-tab-link[data-w-tab="Tab 2"]').click();
    await page.waitForTimeout(500);
    const select = page.locator('.z47-insights-month-select');
    assert.equal(await select.inputValue(), '2026-09');
    assert.equal(await select.locator('option').count(), 4);
    const toolbar = page.locator('.insights_toolbar_wrap');
    assert.equal(await toolbar.count(), 1);
    assert.match(await toolbar.textContent(), /MONTHLY TAKEAWAY.*SEP 2026/);
    assert(!(await page.locator('#sept-insights .index-header-wrap').first().isVisible()));
    let toolbarBox = await toolbar.boundingBox();
    let selectBox = await select.boundingBox();
    assert(Math.abs(toolbarBox.x + toolbarBox.width - selectBox.x - selectBox.width) < 2, 'dropdown right aligned');
    await select.selectOption('2026-08');
    assert(await page.locator('#sept-insights').isVisible(), 'outgoing month remains during fade-out');
    assert(await page.locator('#sept-insights').evaluate(e => e.getAnimations().length > 0));
    await page.waitForTimeout(190);
    assert(await page.locator('#aug-insights').isVisible());
    assert(!(await page.locator('#sept-insights').isVisible()));
    assert(await page.locator('#aug-insights').evaluate(e => e.getAnimations().length > 0));
    assert(await page.locator('#aug-insights').evaluate(e => e.parentElement.getAnimations().length > 0), 'container height animates');
    await select.selectOption('2026-07');
    await select.selectOption('2026-06');
    await page.waitForTimeout(600);
    assert.equal(await page.locator('#aug-insights').evaluate(e => e.getAnimations().length), 0);
    assert(await page.locator('#june-insights').isVisible());
    assert.match(await toolbar.textContent(), /MONTHLY TAKEAWAY.*JUN 2026/);
    assert.equal(await page.locator('#june-insights').evaluate(e => e.parentElement.style.overflow), '');
    await select.selectOption('2026-09');
    await page.waitForTimeout(600);
    await page.evaluate(() => window.scrollTo(0, 950));
    await page.waitForTimeout(150);
    const menuBox = await page.locator('.index-tabs-menu').boundingBox();
    toolbarBox = await toolbar.boundingBox();
    assert(Math.abs(toolbarBox.y - menuBox.y - menuBox.height) < 2, 'toolbar sticks immediately below desktop tabs');
    await page.screenshot({ path: '/tmp/z47-insights-sticky-desktop.png' });
    await select.selectOption('2026-07');
    await page.waitForTimeout(600);
    assert(Math.abs((await toolbar.boundingBox()).y - toolbarBox.y) < 2, 'month animation does not move sticky toolbar');
    await page.setViewportSize({ width: 1440, height: 400 });
    await page.evaluate(() => {
      const bottom = document.querySelector('.insights-tab-wrap').getBoundingClientRect().bottom + window.scrollY;
      window.scrollTo(0, bottom - 40);
    });
    await page.waitForTimeout(150);
    const endBox = await toolbar.boundingBox();
    const insightsBox = await page.locator('.insights-tab-wrap').boundingBox();
    assert(endBox.y < menuBox.height, 'toolbar releases at end of Insights');
    assert(endBox.y + endBox.height <= insightsBox.y + insightsBox.height + 2, 'toolbar remains within Insights');
    await page.setViewportSize({ width: 1440, height: 1050 });
    await select.selectOption('2026-09');
    await page.waitForTimeout(600);
    await page.locator('.w-tab-link[data-w-tab="Tab 2"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/tmp/z47-insights-dropdown-desktop.png' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await select.selectOption('2026-08');
    assert.equal(await page.locator('#aug-insights').evaluate(e => e.getAnimations().length), 0);
    await select.focus();
    assert(await select.evaluate(e => document.activeElement === e));
    assert.equal(await select.getAttribute('aria-label'), 'Insights month');
    assert.equal(await select.evaluate(e => getComputedStyle(e).outlineStyle), 'none');
    await page.setViewportSize({ width: 390, height: 844 });
    await select.scrollIntoViewIfNeeded();
    const box = await select.boundingBox();
    assert(box.x >= 0 && box.x + box.width <= 390);
    await page.screenshot({ path: '/tmp/z47-insights-dropdown-mobile.png' });
    // Fresh mobile load exercises the site's separate mobile tab navigation script.
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await excludeInstalledSwitcher(mobile);
    await mobile.goto('https://z47.webflow.io/z47-forty-seven', { waitUntil: 'domcontentloaded' });
    await mobile.locator('.dd_tabs').click();
    await mobile.locator('.w-tab-link[data-w-tab="Tab 2"]').click();
    await mobile.waitForTimeout(500);
    await mobile.evaluate(() => {
      document.querySelectorAll('.insights-tab-wrap').forEach(w => delete w.dataset.insightsReady);
      document.querySelectorAll('.z47-insights-month-select').forEach(s => s.remove());
      document.querySelectorAll('style').forEach(s => {
        if (s.textContent.includes('.z47-insights-month-select')) s.remove();
      });
    });
    await mobile.addStyleTag({ path: path.resolve('staging/css/09-insights-months.css') });
    await mobile.addScriptTag({ path: path.resolve('staging/js/09-insights-months.js') });
    await mobile.evaluate(() => window.scrollTo(0, 950));
    await mobile.waitForTimeout(150);
    const mobileToolbar = mobile.locator('.insights_toolbar_wrap');
    const mobileTabBox = await mobile.locator('.dd_tabs').boundingBox();
    const mobileToolbarBox = await mobileToolbar.boundingBox();
    assert(Math.abs(mobileToolbarBox.y - mobileTabBox.y - mobileTabBox.height) < 2, 'toolbar below mobile tabs');
    await mobile.screenshot({ path: '/tmp/z47-insights-sticky-mobile.png' });
    await mobile.locator('.dd_tabs').click();
    await mobile.waitForTimeout(250);
    await mobile.screenshot({ path: '/tmp/z47-insights-mobile-menu-open.png' });
    await mobile.locator('.w-tab-link[data-w-tab="Tab 3"]').click({timeout:5000});
    await mobile.waitForTimeout(500);
    assert(!(await mobileToolbar.isVisible()), 'toolbar only appears in Insights');
    await assertTabSpacing(mobile, true);
    await mobile.setViewportSize({ width: 1440, height: 1050 });
    await mobile.waitForTimeout(150);
    await assertTabSpacing(mobile, false);
    await mobile.close();
    console.log('PASS: live markup, four months, animation, rapid switching, reduced motion, focus, mobile fit');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Listen to all requests
  page.on('requestfailed', request => {
    console.log('[RequestFailed]', request.url(), request.failure().errorText);
  });
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log('[HTTP Error]', response.status(), response.url());
    }
  });

  await page.goto('http://localhost:3000/memory');
  await page.waitForLoadState('networkidle');
  console.log('Page loaded');

  // Click graph tab
  const graphTab = page.locator('.nav-tab').filter({ hasText: '图谱' });
  console.log('Graph tab count:', await graphTab.count());
  await graphTab.click();
  console.log('Clicked graph tab');
  await page.waitForTimeout(6000);

  // Check for graph container
  const graphContainer = page.locator('.graph-container');
  console.log('Graph container count:', await graphContainer.count());

  if (await graphContainer.count() > 0) {
    // Check shadow DOM and canvas
    const debugInfo = await page.evaluate(() => {
      const container = document.querySelector('.graph-container');
      if (!container) return { error: 'no container' };
      const shadow = container.shadowRoot;
      if (!shadow) return { error: 'no shadow root', html: container.innerHTML };
      const canvas = shadow.querySelector('canvas');
      if (canvas) {
        return {
          found: 'canvas',
          width: canvas.width,
          height: canvas.height
        };
      }
      return {
        found: 'no canvas',
        shadowChildren: shadow.children.length,
        shadowHTML: shadow.innerHTML.substring(0, 1000)
      };
    });
    console.log('Debug info:', JSON.stringify(debugInfo, null, 2));

    // Screenshot
    await graphContainer.screenshot({ path: 'graph-debug-screenshot.png' });
    console.log('Screenshot saved');
  }

  await browser.close();
})();
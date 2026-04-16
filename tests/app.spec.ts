import { test, expect } from '@playwright/test';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

test.describe('Memory Manager API', () => {
  test('health check', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.status()).toBe(200);
  });

  test('status returns expected fields', async ({ request }) => {
    const res = await request.get('/status');
    const body = await res.json();
    expect(body).toHaveProperty('model_loaded');
    expect(body).toHaveProperty('qdrant_ready');
    expect(body).toHaveProperty('device');
    expect(body).toHaveProperty('embedding_model');
  });

  test('status returns qdrant config fields', async ({ request }) => {
    const res = await request.get('/status');
    const body = await res.json();
    expect(body).toHaveProperty('qdrant_host');
    expect(body).toHaveProperty('qdrant_port');
    expect(body).toHaveProperty('qdrant_collection');
    expect(body).toHaveProperty('qdrant_top_k');
    expect(typeof body.qdrant_port).toBe('number');
    expect(typeof body.qdrant_top_k).toBe('number');
  });

  test('settings GET/POST works', async ({ request }) => {
    let res = await request.get('/settings');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('device');

    res = await request.post('/settings', { headers: JSON_HEADERS, data: '{"device":"cpu"}' });
    expect(res.status()).toBe(200);
  });

  test('db-status returns ok', async ({ request }) => {
    const res = await request.get('/db-status');
    const body = await res.json();
    expect(body.ok).toBeTruthy();
    expect(body).toHaveProperty('records');
  });

  test('chart-data returns data structure', async ({ request }) => {
    const res = await request.get('/chart-data?range=today');
    const body = await res.json();
    expect(body).toHaveProperty('range', 'today');
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test('system-info returns system metrics', async ({ request }) => {
    const res = await request.get('/system-info');
    const body = await res.json();
    expect(body).toHaveProperty('cpu_percent');
    expect(body).toHaveProperty('memory_total');
    expect(body).toHaveProperty('platform');
  });

  test('store and search memory', async ({ request }) => {
    const storeRes = await request.post('/store', {
      headers: JSON_HEADERS,
      data: JSON.stringify({ text: 'Playwright 测试记忆' })
    });
    expect(storeRes.status()).toBe(200);

    const searchRes = await request.post('/search', {
      headers: JSON_HEADERS,
      data: JSON.stringify({ query: '测试' })
    });
    const body = await searchRes.json();
    expect(searchRes.status()).toBe(200);
    expect(body.results.length).toBeGreaterThan(0);
  });

  test('list memories', async ({ request }) => {
    const res = await request.post('/list', {
      headers: JSON_HEADERS,
      data: '{}'
    });
    const body = await res.json();
    expect(res.status()).toBe(200);
    expect(body).toHaveProperty('memories');
  });
});

test.describe('Memory Manager Page', () => {
  test('page loads without crash', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.nav-sidebar')).toBeVisible();
  });

  test('navigation tabs exist', async ({ page }) => {
    await page.goto('/');
    const navItems = page.locator('.nav-item');
    await expect(navItems).toHaveCount(4);
  });

  test('overview tab shows status cards', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-page="overview"]');
    await page.waitForLoadState('networkidle');
    const cards = page.locator('.status-card');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
  });

  test('overview shows qdrant config info', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-page="overview"]');
    await page.waitForLoadState('networkidle');
    // 等待 Qdrant 配置信息加载完成（文本内容不为空）
    await page.waitForFunction(() => {
      const el = document.getElementById('scQdrantHostSub');
      return el && el.textContent && el.textContent.includes('Host:');
    }, { timeout: 10000 });
    const qdrantHost = page.locator('#scQdrantHostSub');
    const text = await qdrantHost.textContent();
    expect(text).toContain('Host:');
  });

  test('memory page has scrollable list container', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-page="memory"]');
    await page.waitForLoadState('networkidle');
    // 检查滚动容器 .memory-list-container 有正确的 overflow 样式
    const scrollContainer = page.locator('.memory-list-container');
    await expect(scrollContainer).toBeVisible();
    const styles = await scrollContainer.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        overflowY: computed.overflowY,
        flex: computed.flex
      };
    });
    expect(styles.overflowY).toBe('auto');
    // 检查主布局没有滚动
    const layout = page.locator('.memory-layout');
    const layoutStyles = await layout.evaluate(el => {
      return window.getComputedStyle(el).overflow;
    });
    expect(layoutStyles).toBe('hidden');
  });

  test('steam tab loads stream UI', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-page="steam"]');
    await page.waitForLoadState('networkidle');
    // 检查两栏布局存在
    const storeList = page.locator('#storeList');
    const searchList = page.locator('#searchList');
    await expect(storeList).toBeVisible({ timeout: 5000 });
    await expect(searchList).toBeVisible({ timeout: 5000 });
  });

  test('log endpoint accepts frontend logs', async ({ request }) => {
    const res = await request.post('/log', {
      headers: JSON_HEADERS,
      data: JSON.stringify({ level: 'info', message: 'Playwright test log', source: 'e2e-test' })
    });
    expect(res.status()).toBe(200);
  });
});

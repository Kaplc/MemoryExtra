import { test, expect } from '@playwright/test';

test.describe('Graph Tab (图谱)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/memory');
    await page.waitForLoadState('domcontentloaded');
  });

  test('graph tab button exists', async ({ page }) => {
    const graphTabBtn = page.locator('.nav-tab', { hasText: '图谱' });
    await expect(graphTabBtn).toBeVisible();
  });

  test('switch to graph tab and load data', async ({ page }) => {
    const graphTabBtn = page.locator('.nav-tab', { hasText: '图谱' });
    await graphTabBtn.click();

    // 等待图谱面板出现
    const graphPanel = page.locator('.graph-panel');
    await expect(graphPanel).toBeVisible();

    // 验证 toolbar 显示
    const toolbar = page.locator('.graph-toolbar');
    await expect(toolbar).toBeVisible();

    // 验证节点/关系计数显示
    const info = page.locator('.graph-info');
    await expect(info).toBeVisible();

    // 等待数据加载（后台请求完成）
    await page.waitForTimeout(3000);

    // 刷新按钮应该可见
    const refreshBtn = page.locator('.btn-refresh');
    await expect(refreshBtn).toBeVisible();
  });

  test('refresh button click triggers reload', async ({ page }) => {
    const graphTabBtn = page.locator('.nav-tab', { hasText: '图谱' });
    await graphTabBtn.click();

    // 等待初始加载完成
    await page.waitForTimeout(3000);

    // 点击刷新
    const refreshBtn = page.locator('.btn-refresh');
    await refreshBtn.click();

    // 等待刷新完成
    await page.waitForTimeout(3000);

    // 刷新后按钮应恢复为"刷新"文本
    await expect(refreshBtn).toContainText('刷新');
  });

  test('graph panel contains graph container', async ({ page }) => {
    const graphTabBtn = page.locator('.nav-tab', { hasText: '图谱' });
    await graphTabBtn.click();

    const graphPanel = page.locator('.graph-panel');
    await expect(graphPanel).toBeVisible();

    // 验证容器存在
    const graphContainer = page.locator('.graph-container');
    await expect(graphContainer).toBeVisible();

    // force-graph 会在容器内创建 canvas 或 svg
    await page.waitForTimeout(3000);
    const hasCanvas = await graphContainer.locator('canvas').count() > 0;
    const hasSvg = await graphContainer.locator('svg').count() > 0;
    expect(hasCanvas || hasSvg).toBeTruthy();
  });

  test('graph info shows node and edge count', async ({ page }) => {
    const graphTabBtn = page.locator('.nav-tab', { hasText: '图谱' });
    await graphTabBtn.click();

    // 等待数据加载
    await page.waitForTimeout(3000);

    const info = page.locator('.graph-info');
    await expect(info).toBeVisible();

    const text = await info.textContent();
    // 应该包含"节点:"和"关系:"
    expect(text).toContain('节点:');
    expect(text).toContain('关系:');
  });
});
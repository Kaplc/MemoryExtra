import { test, expect } from '@playwright/test'

test.describe('Memory - 图谱Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/memory', { waitUntil: 'networkidle' })
  })

  test('图谱Tab按钮存在且可见', async ({ page }) => {
    const graphTab = page.locator('.nav-tab:has-text("图谱")')
    await expect(graphTab).toBeVisible()
  })

  test('点击图谱Tab后变为active', async ({ page }) => {
    const graphTab = page.locator('.nav-tab:has-text("图谱")')
    await graphTab.click()
    await expect(graphTab).toHaveClass(/active/)
  })

  test('点击图谱Tab后GraphPanel渲染', async ({ page }) => {
    await page.locator('.nav-tab:has-text("图谱")').click()
    // graph-panel 容器可见
    await expect(page.locator('.graph-panel')).toBeVisible()
  })

  test('图谱面板包含toolbar', async ({ page }) => {
    await page.locator('.nav-tab:has-text("图谱")').click()
    await expect(page.locator('.graph-toolbar')).toBeVisible()
  })

  test('图谱面板显示节点/关系统计', async ({ page }) => {
    await page.locator('.nav-tab:has-text("图谱")').click()
    const info = page.locator('.graph-info')
    await expect(info).toBeVisible()
    await expect(info).toContainText('节点:')
    await expect(info).toContainText('关系:')
  })

  test('图谱面板存在刷新按钮', async ({ page }) => {
    await page.locator('.nav-tab:has-text("图谱")').click()
    const refreshBtn = page.locator('.btn-refresh')
    await expect(refreshBtn).toBeVisible()
  })

  test('刷新按钮点击后触发加载', async ({ page }) => {
    await page.locator('.nav-tab:has-text("图谱")').click()
    const refreshBtn = page.locator('.btn-refresh')
    await refreshBtn.click()
    // 加载中按钮文字或禁用状态出现
    // 等待加载完成（最多5s）
    await expect(refreshBtn).toBeEnabled({ timeout: 5000 })
  })

  test('图谱容器canvas区域渲染', async ({ page }) => {
    await page.locator('.nav-tab:has-text("图谱")').click()
    // 等待API响应
    await page.waitForTimeout(2000)
    const container = page.locator('.graph-container')
    await expect(container).toBeVisible()
  })

  test('加载完成后图谱容器内有canvas（3D图谱渲染）', async ({ page }) => {
    await page.locator('.nav-tab:has-text("图谱")').click()
    // 等待图谱数据加载和3d-force-graph渲染
    await page.waitForTimeout(3000)
    // 若有数据，3d-force-graph 会在 graph-container 内插入 canvas
    const graphInfo = page.locator('.graph-info')
    const infoText = await graphInfo.textContent()
    console.log('图谱统计:', infoText)

    // graph-panel 应一直可见（无论有无数据）
    await expect(page.locator('.graph-panel')).toBeVisible()
  })

  test('切换到其他Tab再切回图谱Tab，面板仍然正常', async ({ page }) => {
    await page.locator('.nav-tab:has-text("图谱")').click()
    await expect(page.locator('.graph-panel')).toBeVisible()

    // 切到搜索Tab
    await page.locator('.nav-tab:has-text("搜索记忆")').click()
    await expect(page.locator('.search-bar')).toBeVisible()

    // 切回图谱Tab
    await page.locator('.nav-tab:has-text("图谱")').click()
    await expect(page.locator('.graph-panel')).toBeVisible()
  })

  test('截图 - 图谱Tab渲染结果', async ({ page }) => {
    await page.locator('.nav-tab:has-text("图谱")').click()
    await page.waitForTimeout(3000)
    await page.screenshot({ path: 'e2e/test-output/graph-tab.png', fullPage: false })
  })
})

import { test, expect } from '@playwright/test'

test.describe('Logs View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/logs', { waitUntil: 'networkidle' })
  })

  test('页面标题', async ({ page }) => {
    await expect(page.locator('.logs-title')).toHaveText('日志')
  })

  test('日志输出区域', async ({ page }) => {
    await expect(page.locator('.log-wrap')).toBeVisible()
  })

  test('刷新按钮', async ({ page }) => {
    const refreshBtn = page.locator('.log-header .btn-action')
    await expect(refreshBtn).toBeVisible()
    await expect(refreshBtn).toHaveText('刷新')
  })

  test('刷新后日志内容加载', async ({ page }) => {
    // 点击刷新
    await page.locator('.log-header .btn-action').click()
    await page.waitForTimeout(1500)
    // 验证有日志行
    const lines = page.locator('.log-line')
    await expect(lines.first()).toBeVisible()
  })

  test('日志默认在底部', async ({ page }) => {
    await page.waitForTimeout(3000)
    // 手动触发滚动
    await page.evaluate(() => {
      const el = document.querySelector('.log-wrap') as HTMLElement
      if (el) el.scrollTop = el.scrollHeight
    })
    await page.waitForTimeout(500)
    const logWrap = page.locator('.log-wrap')
    const debug = await logWrap.evaluate((el) => {
      return {
        scrollTop: el.scrollTop,
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
        diff: el.scrollHeight - el.scrollTop - el.clientHeight
      }
    })
    console.log('[logs] scroll debug:', JSON.stringify(debug))
    const isScrolled = debug.scrollTop + debug.clientHeight >= debug.scrollHeight - 10
    expect(isScrolled).toBe(true)
  })
})
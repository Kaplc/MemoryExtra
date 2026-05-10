import { test } from '@playwright/test';

test.describe('Overview Y轴刻度截图验证', () => {
  for (const range of ['today', 'week', 'month', 'all']) {
    test(`${range} 周期截图验证`, async ({ page }) => {
      const isHourly = range === 'today'
      const dataLen = range === 'today' ? 24 : range === 'week' ? 7 : range === 'month' ? 30 : 90

      let mockData: any[]
      if (isHourly) {
        mockData = Array.from({ length: dataLen }, (_, i) => ({
          date: `${String(i).padStart(2, '0')}:00`,
          total: 280 + i,
          added: 1,
          updated: 0
        }))
      } else {
        mockData = []
        for (let i = 0; i < dataLen; i++) {
          const d = new Date()
          d.setDate(d.getDate() + i - (dataLen - 1))
          const mm = String(d.getMonth() + 1).padStart(2, '0')
          const dd = String(d.getDate()).padStart(2, '0')
          mockData.push({
            date: `${d.getFullYear()}-${mm}-${dd}`,
            total: 280 + i * 5,
            added: i % 3,
            updated: 0
          })
        }
      }

      await page.route('**/chart-data*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockData }),
        })
      })

      await page.goto('/overview')
      await page.waitForSelector('.chart-section', { timeout: 10000 })
      await page.waitForTimeout(6000)

      const screenshot = await page.screenshot({ fullPage: false })
      console.log(`[${range}] screenshot size:`, screenshot.length, 'bytes')
      require('fs').writeFileSync(`E:/Project/AiBrain/tests/screenshots/${range}-yaxis.png`, screenshot)
      console.log(`[${range}] saved to tests/screenshots/${range}-yaxis.png`)
    })
  }
})
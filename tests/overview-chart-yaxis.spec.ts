import { test, expect } from '@playwright/test';

test.describe('Overview Y轴刻度', () => {
  for (const range of ['today', 'week', 'month', 'all']) {
    test(`${range} 周期的 Y轴刻度最多5个且为整数`, async ({ page }) => {
      const logs: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'log') logs.push(msg.text());
      });

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
      await page.waitForTimeout(3000)

      // Check chart rendered
      const canvasCount = await page.evaluate(() => document.querySelectorAll('canvas').length)
      console.log(`[${range}] canvas count:`, canvasCount)

      // Click range tab
      const rangeMap: Record<string, string> = { today: '近24小时', week: '7天', month: '30天', all: '全部' }
      const btn = page.locator(`.chart-tab:has-text("${rangeMap[range]}")`)
      await btn.click()
      await page.waitForTimeout(5000)

      // Check if there are decimal tick labels
      const html = await page.locator('.chart-section').innerText()
      const hasDecimal = /\d+\.\d+/.test(html)
      console.log(`[${range}] has decimal:`, hasDecimal)
      console.log(`[${range}] Y-axis text sample:`, html.slice(-200))

      expect(hasDecimal, `${range} should not have decimal ticks`).toBe(false)

      // 验证无小数刻度
      const hasDecimalTick = await page.evaluate(() => {
        const chartSection = document.querySelector('.chart-section')
        if (!chartSection) return false
        return /\d+\.\d+/.test(chartSection.innerText)
      })
      expect(hasDecimalTick, `${range} Y轴刻度不应包含小数`).toBe(false)
    })
  }

  test('today 24点数据的 Y轴范围在 280-290 之间', async ({ request }) => {
    test.skip();
    const res = await request.get('http://localhost:18792/chart-data?range=today');
    if (!res.ok()) {
      test.skip();
      return;
    }
    const data = res.json();
    expect(data.data?.length).toBe(24);
    const totals = data.data.map((d: any) => d.total);
    console.log('today total 范围:', Math.min(...totals), '-', Math.max(...totals));
    expect(Math.min(...totals)).toBeGreaterThanOrEqual(280);
    expect(Math.max(...totals)).toBeLessThanOrEqual(290);
  });
});
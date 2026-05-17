const { chromium } = require('playwright');
const { readFileSync } = require('fs');

const portFile = '.port_config'
let basePort = '19398'
try {
  const ports = readFileSync(portFile, 'utf-8').trim().split(',')
  basePort = ports[0] || '19398'
} catch {}

(async () => {
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage()

  // Force hard reload to bypass cache
  await page.goto(`http://127.0.0.1:${basePort}/stream?t=${Date.now()}`, { waitUntil: 'networkidle' })

  // Wait for Vite HMR
  await page.waitForTimeout(3000)

  // Force a refresh
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  await page.screenshot({ path: 'stream-view-screenshot.png', fullPage: false })

  // Get the bounding box of the first stream item
  const firstItem = page.locator('.stream-item').first()
  const box = await firstItem.boundingBox()
  console.log('First item bounding box:', JSON.stringify(box))

  // Check if expand button is visible and where
  const expandBtn = firstItem.locator('.stream-expand-btn')
  const btnBox = await expandBtn.boundingBox()
  console.log('Expand button bounding box:', JSON.stringify(btnBox))

  console.log('Screenshot saved')
  await browser.close()
})()
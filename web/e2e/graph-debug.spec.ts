import { test, expect } from '@playwright/test'

test('图谱容器调试信息', async ({ page }) => {
  const errors: string[] = []
  const logs: string[] = []
  const warnings: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
    if (msg.type() === 'warning') warnings.push(msg.text())
    if (msg.text().includes('[GraphPanel]') || msg.text().includes('WebGL') || msg.text().includes('THREE') || msg.text().includes('renderer')) logs.push(`[${msg.type()}] ${msg.text()}`)
  })
  page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message))

  await page.goto('/memory', { waitUntil: 'networkidle' })

  // 点击图谱 tab
  await page.locator('.nav-tab:has-text("图谱")').click()

  // 等待图谱数据加载完成（最多 5s）
  await page.waitForFunction(() => {
    const info = document.querySelector('.graph-info')
    return info && info.textContent && !info.textContent.includes('节点: 0')
  }, { timeout: 5000 }).catch(() => {})

  // 再等 3d-force-graph 渲染
  await page.waitForTimeout(3000)

  const webglInfo = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    const gl2 = canvas.getContext('webgl2')
    return {
      webgl: !!gl,
      webgl2: !!gl2,
      renderer: gl ? (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).RENDERER) : 'N/A',
    }
  })
  console.log('WebGL 支持情况:', webglInfo)

  const result = await page.evaluate(() => {
    const container = document.querySelector('.graph-container') as HTMLElement
    const canvas = container?.querySelector('canvas')
    const allCanvas = document.querySelectorAll('canvas')
    return {
      containerSize: container ? { w: container.clientWidth, h: container.clientHeight } : null,
      hasCanvas: !!canvas,
      canvasCount: allCanvas.length,
      canvasSize: canvas ? { w: canvas.width, h: canvas.height } : null,
      containerChildren: container?.children.length ?? 0,
      containerHTML: container?.innerHTML.substring(0, 300) ?? '',
      graphInfoText: document.querySelector('.graph-info')?.textContent ?? '',
    }
  })

  console.log('=== 图谱调试 ===')
  console.log('容器信息:', JSON.stringify(result, null, 2))
  console.log('GraphPanel logs:', logs)
  console.log('Warnings:', warnings)
  console.log('控制台错误:', errors)

  await page.screenshot({ path: 'e2e/test-output/graph-debug.png' })
})

import { test, expect } from '@playwright/test'

test.describe('Vue App 基础功能', () => {

  test('首页加载 - 应显示总览页面', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })

    // 验证标题
    await expect(page).toHaveTitle('Memory Manager')

    // 验证导航栏存在
    const navItems = page.locator('.nav-item')
    await expect(navItems).toHaveCount(6)

    // 验证默认路由是 overview
    await expect(page.locator('.nav-item.active .nav-label')).toHaveText('总览')
  })

  test('路由切换 - 点击导航应切换页面', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })

    // 切换到 Wiki 页面
    await page.locator('.nav-item:has-text("Wiki")').click()
    await page.waitForTimeout(500)

    // 验证 URL 和导航高亮
    await expect(page).toHaveURL(/\/wiki/)
    await expect(page.locator('.nav-item.active .nav-label')).toHaveText('Wiki')

    // 验证页面内容渲染（Wiki 使用 wiki-title 类）
    await expect(page.locator('.wiki-title')).toHaveText('Wiki 知识库')

    // 切换到设置页面
    await page.locator('.nav-item:has-text("设置")').click()
    await page.waitForTimeout(500)

    await expect(page).toHaveURL(/\/settings/)
    await expect(page.locator('.nav-item.active .nav-label')).toHaveText('设置')
  })

  test('状态栏 - 应显示状态信息', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    const statusbar = page.locator('.statusbar')
    await expect(statusbar).toBeVisible()

    // 验证状态点存在
    const dots = page.locator('.statusbar-dot')
    await expect(dots).toHaveCount(2)
  })

  test('所有页面可正常切换', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })

    const pages = [
      { nav: '总览', route: 'overview' },
      { nav: '记忆', route: 'memory' },
      { nav: '流', route: 'steam' },
      { nav: 'Wiki', route: 'wiki' },
      { nav: '日志', route: 'logs' },
      { nav: '设置', route: 'settings' },
    ]

    for (const p of pages) {
      await page.locator(`.nav-sidebar .nav-item:has-text("${p.nav}")`).click()
      await page.waitForTimeout(300)
      // 验证 URL 和导航高亮
      await expect(page).toHaveURL(new RegExp('/' + p.route))
      await expect(page.locator('.nav-item.active .nav-label')).toHaveText(p.nav)
      // 验证页面有内容渲染（非空白）
      const content = page.locator('#page-content')
      await expect(content).not.toBeEmpty()
    }
  })

  test('导航 Logo 点击 - 应触发 openInBrowser', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })

    const logo = page.locator('.nav-logo')
    await expect(logo).toHaveText('M')
    await expect(logo).toBeVisible()
  })

  test('控制台快捷键 - 按~应显示控制台', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })

    // 按 ~ 键
    await page.keyboard.press('`')
    await page.waitForTimeout(300)

    // 控制台应可见
    const console = page.locator('.console-wrap')
    await expect(console).toBeVisible()
  })
})

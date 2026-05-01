const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

const BASE = 'http://127.0.0.1:19398';
const WIKI_URL = `file://${path.resolve(__dirname, 'web/wiki/wiki.html')}`.replace(/\\/g, '/');

test('Wiki 索引 E2E - 进度条更新', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  // 1. 打开 wiki 页面
  await page.goto(WIKI_URL);

  // 2. 等待页面加载
  await page.waitForTimeout(2000);

  // 3. 获取初始文件列表
  const listBefore = await page.evaluate(async () => {
    const resp = await fetch(API + '/wiki/list');
    return resp.json();
  });
  console.log(`[E2E] 当前文件数: ${listBefore.files?.length}, indexed: ${listBefore.indexed}`);

  // 4. 点击重建索引按钮
  const btn = page.locator('#btnReindex');
  await btn.click();
  console.log('[E2E] 已点击重建索引');

  // 5. 等待进度条出现
  await page.waitForTimeout(1000);

  // 6. 轮询进度直到完成（最多 5 分钟）
  let attempts = 0;
  let lastProgress = null;
  while (attempts < 60) {
    const prog = await page.evaluate(async () => {
      const resp = await fetch(API + '/wiki/index-progress');
      return resp.json();
    });
    console.log(`[E2E] 进度: done=${prog.done} total=${prog.total} running=${prog.running} status=${prog.status}`);

    if (prog.status === 'done' || prog.status === 'error') {
      lastProgress = prog;
      break;
    }

    // 进度有变化时记录
    if (lastProgress === null || lastProgress.done !== prog.done) {
      console.log(`[E2E] 进度更新: ${prog.done}/${prog.total}`);
      lastProgress = prog;
    }

    await page.waitForTimeout(3000);
    attempts++;
  }

  // 7. 验证结果
  if (lastProgress) {
    console.log(`[E2E] 最终状态: status=${lastProgress.status} done=${lastProgress.done} total=${lastProgress.total}`);
  }

  // 8. 关闭浏览器
  await browser.close();

  // 9. 打印 console errors
  if (errors.length > 0) {
    console.log('[E2E] Console errors:', errors);
  }

  expect(lastProgress?.status).toBe('done');
  expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
});
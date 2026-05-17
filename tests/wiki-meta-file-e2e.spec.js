/**
 * Wiki 索引 E2E - 跟踪文件列表 items 的 index_status 是否随进度实时更新
 */
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const META_FILE = path.join(__dirname, '..', 'rag', 'lightrag_data', '.wiki_index_meta.json');

async function readMetaFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function main() {
  console.log('[E2E] 启动 - 跟踪文件列表 index_status 实时更新');

  // 1. 删除元数据文件
  try { fs.unlinkSync(META_FILE); } catch {}

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 2. 打开 wiki 页面
  await page.goto('http://127.0.0.1:19398/wiki', { waitUntil: 'networkidle' });
  console.log('[E2E] ✓ 页面已打开');

  // 3. 获取 DOM 中文件状态
  const getFileStatuses = async () => {
    return await page.evaluate(() => {
      const rows = document.querySelectorAll('table.file-table tbody tr');
      const result = [];
      rows.forEach(row => {
        const name = row.querySelector('.ft-name')?.textContent?.trim() || '';
        const synced = row.querySelector('span[title="已同步"]') !== null;
        const notIndexed = row.querySelector('span[title="未索引"]') !== null;
        result.push({ name, status: synced ? 'synced' : notIndexed ? 'not_indexed' : 'out_of_sync' });
      });
      return result;
    });
  };

  const initialStatuses = await getFileStatuses();
  const initialFiles = initialStatuses.length;
  const syncedBefore = initialStatuses.filter(f => f.status === 'synced').length;
  console.log(`[E2E] 初始文件数: ${initialFiles}, 已同步: ${syncedBefore}`);

  // 4. 点击重建索引
  await page.locator('.side-tab-btn:has-text("操作")').click();
  await new Promise(r => setTimeout(r, 300));
  await page.locator('.ops-btn:has-text("重建索引")').click();
  console.log('[E2E] ✓ 已点击重建索引');

  // 5. 实时跟踪
  let lastApiDone = -1;
  let iteration = 0;

  while (iteration < 120) {
    iteration++;
    let apiProg = null;
    try {
      const raw = await page.evaluate(async () => {
        try {
          const r = await fetch('http://127.0.0.1:19398/wiki/index-progress');
          return { ok: r.ok, data: await r.json() };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      });
      if (raw.ok) apiProg = raw.data;
    } catch {}

    if (!apiProg) { await new Promise(r => setTimeout(r, 500)); continue; }

    const { done, total, status, current_file } = apiProg;
    const statuses = await getFileStatuses();
    const syncedNow = statuses.filter(f => f.status === 'synced').length;
    const meta = await readMetaFile(META_FILE);
    const metaFileCount = meta ? Object.keys(meta.files || {}).length : -1;

    if (done !== lastApiDone) {
      const syncRate = initialFiles > 0 ? ((syncedNow / initialFiles) * 100).toFixed(0) : 0;
      console.log(`API: ${done}/${total} | DOM已同步: ${syncedNow}/${initialFiles} (${syncRate}%) | meta: ${metaFileCount} | 当前: ${current_file}`);
      lastApiDone = done;
    }

    if (status === 'done' || status === 'error') {
      await new Promise(r => setTimeout(r, 500)); // 等待浏览器处理 + Vue 渲染
      const finalStatuses = await getFileStatuses();
      const finalSynced = finalStatuses.filter(f => f.status === 'synced').length;

      console.log(`\n========== 索引完成 ==========`);
      console.log(`API: done=${done} total=${total} status=${status}`);
      console.log(`DOM 最终已同步: ${finalSynced}/${initialFiles} (${Math.round((finalSynced / initialFiles) * 100)}%)`);
      console.log(`文件列表是否实时更新: ${finalSynced > syncedBefore ? '✅ 是' : '❌ 否'}`);
      break;
    }

    await new Promise(r => setTimeout(r, 500));
  }

  if (iteration >= 120) console.log('\n========== 超时 ==========');
  await browser.close();
}

main().catch(console.error);

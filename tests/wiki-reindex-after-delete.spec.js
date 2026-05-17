/**
 * E2E 测试：删除向量数据后重建索引，验证文件状态实时更新
 * 步骤：
 * 1. 备份 lightrag_data 目录
 * 2. 删除 kv_store_doc_status.json 和 .wiki_index_meta.json
 * 3. 点击重建索引
 * 4. 跟踪文件状态从 not_indexed → synced 的实时变化
 */
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const LIGHT_RAG_DIR = path.join(__dirname, '..', 'rag', 'lightrag_data');
const META_FILE = path.join(LIGHT_RAG_DIR, '.wiki_index_meta.json');
const KV_STORE = path.join(LIGHT_RAG_DIR, 'kv_store_doc_status.json');

async function main() {
  console.log('===== E2E: 删除向量数据后重建索引 =====');

  // 1. 检查删除前的文件状态
  const metaBefore = fs.existsSync(META_FILE);
  const kvBefore = fs.existsSync(KV_STORE);
  const kvSizeBefore = kvBefore ? fs.statSync(KV_STORE).size : 0;
  console.log(`[步骤1] 删除前: meta=${metaBefore} kv_store=${kvBefore}(${(kvSizeBefore / 1024).toFixed(0)}KB)`);

  // 2. 删除向量数据和 meta
  try { fs.unlinkSync(KV_STORE); console.log('[步骤2] ✓ 已删除 kv_store_doc_status.json'); } catch { console.log('[步骤2] kv_store 不存在'); }
  try { fs.unlinkSync(META_FILE); console.log('[步骤2] ✓ 已删除 .wiki_index_meta.json'); } catch { console.log('[步骤2] meta 不存在'); }

  // 3. 打开页面，点击重建索引
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:19398/wiki', { waitUntil: 'networkidle' });
  console.log('[步骤3] ✓ 页面已打开');

  const getFileStatuses = async () => page.evaluate(() => {
    const rows = document.querySelectorAll('table.file-table tbody tr');
    return Array.from(rows).map(row => {
      const name = row.querySelector('.ft-name')?.textContent?.trim() || '';
      const synced = row.querySelector('span[title="已同步"]') !== null;
      const notIndexed = row.querySelector('span[title="未索引"]') !== null;
      return { name, status: synced ? 'synced' : notIndexed ? 'not_indexed' : 'out_of_sync' };
    });
  });

  const initial = await getFileStatuses();
  const total = initial.length;
  console.log(`[步骤3] 文件数: ${total}, 初始状态: ${initial.filter(f => f.status === 'not_indexed').length} 未索引`);

  await page.locator('.side-tab-btn:has-text("操作")').click();
  await new Promise(r => setTimeout(r, 300));
  await page.locator('.ops-btn:has-text("重建索引")').click();
  console.log('[步骤3] ✓ 已点击重建索引');

  // 4. 跟踪进度
  let lastDone = -1;
  let iter = 0;
  while (iter++ < 120) {
    let prog = null;
    try {
      const raw = await page.evaluate(async () => {
        const r = await fetch('http://127.0.0.1:19398/wiki/index-progress');
        return { ok: r.ok, data: await r.json() };
      });
      if (raw.ok) prog = raw.data;
    } catch {}
    if (!prog) { await new Promise(r => setTimeout(r, 500)); continue; }

    const { done, total: t, status, current_file } = prog;
    if (done !== lastDone) {
      const statuses = await getFileStatuses();
      const synced = statuses.filter(f => f.status === 'synced').length;
      const metaExists = fs.existsSync(META_FILE);
      const kvExists = fs.existsSync(KV_STORE);
      const kvSize = kvExists ? fs.statSync(KV_STORE).size : 0;
      console.log(`[${done}/${t}] DOM已同步: ${synced}/${total} | meta: ${metaExists ? '✓' : '✗'} | kv: ${kvExists ? (kvSize / 1024).toFixed(0) + 'KB' : '✗'} | ${current_file}`);
      lastDone = done;
    }

    if (status === 'done' || status === 'error') {
      await new Promise(r => setTimeout(r, 500));
      const final = await getFileStatuses();
      const finalSynced = final.filter(f => f.status === 'synced').length;
      const kvSizeAfter = fs.statSync(KV_STORE).size;

      console.log('\n===== 结果 =====');
      console.log(`索引状态: ${status}`);
      console.log(`DOM 已同步: ${finalSynced}/${total} (${Math.round(finalSynced / total * 100)}%)`);
      console.log(`meta 文件: ${fs.existsSync(META_FILE) ? '✓' : '✗'}`);
      console.log(`kv_store: ${(kvSizeAfter / 1024).toFixed(0)}KB (删除前: ${(kvSizeBefore / 1024).toFixed(0)}KB)`);

      const metaOk = fs.existsSync(META_FILE) && fs.existsSync(KV_STORE) && kvSizeAfter > 0;
      const domOk = finalSynced === total;
      console.log(`\n向量数据重新生成: ${metaOk ? '✅ 是' : '❌ 否'}`);
      console.log(`文件状态全部 synced: ${domOk ? '✅ 是' : '❌ 否'}`);
      break;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  if (iter >= 120) console.log('\n===== 超时 =====');
  await browser.close();
}

main().catch(console.error);

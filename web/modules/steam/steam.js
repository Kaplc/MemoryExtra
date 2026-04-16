/* 记忆流页面 - 两栏布局 */
var _streamTimer = null;
var _lastMaxId = 0;

function onPageLoad() {
  loadStream();
  // 每 2 秒轮询新记录
  if (_streamTimer) clearInterval(_streamTimer);
  _streamTimer = setInterval(loadStream, 2000);
}

function cleanup() {
  if (_streamTimer) { clearInterval(_streamTimer); _streamTimer = null; }
}

async function loadStream() {
  try {
    const res = await fetchJson(API + '/stream?limit=100');
    const items = res.items || [];
    const total = res.total || 0;

    // 更新总计数
    const countEl = document.getElementById('streamCount');
    if (countEl) countEl.textContent = `共 ${total} 条`;

    // 分离写入和查询
    const storeItems = items.filter(i => i.action === 'store' || i.action === 'delete');
    const searchItems = items.filter(i => i.action === 'search');

    // 更新各栏计数
    const storeCountEl = document.getElementById('storeCount');
    const searchCountEl = document.getElementById('searchCount');
    if (storeCountEl) storeCountEl.textContent = `${storeItems.length} 条`;
    if (searchCountEl) searchCountEl.textContent = `${searchItems.length} 条`;

    // 找出新增的（id > _lastMaxId）
    const maxId = items.length > 0 ? Math.max(...items.map(i => i.id)) : 0;
    const isNew = (id) => id > _lastMaxId && _lastMaxId > 0;

    // 渲染左侧：写入操作
    renderList('storeList', storeItems, isNew, true);

    // 渲染右侧：查询操作
    renderList('searchList', searchItems, isNew, false);

    _lastMaxId = Math.max(_lastMaxId, maxId);
  } catch(e) { console.error('[stream] load failed:', e); }
}

function renderList(listId, items, isNewFn, showDelete) {
  const listEl = document.getElementById(listId);
  if (!listEl) return;

  if (!items.length) {
    const emptyText = listId === 'storeList' ? '暂无写入记录' : '暂无查询记录';
    listEl.innerHTML = `<div class="steam-empty">${emptyText}</div>`;
    return;
  }

  let html = '';
  items.forEach(item => {
    const actionLabel = item.action === 'store' ? '存入' : item.action === 'search' ? '搜索' : '删除';
    const dotClass = 'steam-dot ' + item.action;
    const newClass = isNewFn(item.id) ? 'new' : '';
    const timeStr = (item.created_at || '').slice(11, 19);
    const text = item.content || item.memory_id || '';

    html += `<div class="steam-item ${newClass}" data-id="${item.id}">
      <div class="${dotClass}"></div>
      <div class="steam-body">
        <span style="font-weight:600;color:#a78bfa;margin-right:6px">${actionLabel}</span>
        <span class="steam-text">${escapeHtml(text)}</span>
      </div>
      <div class="steam-time">${timeStr}</div>
    </div>`;
  });

  listEl.innerHTML = html;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

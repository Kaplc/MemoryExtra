<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useWikiStore } from '@/stores/wiki'
import { useToast } from '@/composables/useToast'

const store = useWikiStore()
const toast = useToast()

/* ==================== API helpers ==================== */

const API_BASE = window.location.origin

async function fetchJson<T>(url: string): Promise<T> {
  const fullUrl = url.startsWith('http') ? url : API_BASE + url
  const r = await fetch(fullUrl)
  return r.json()
}

async function postJson<T>(url: string, body: any): Promise<T> {
  const fullUrl = url.startsWith('http') ? url : API_BASE + url
  const r = await fetch(fullUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return r.json()
}

/* ==================== Formatting helpers ==================== */

function escHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

function formatDate(ts: number): string {
  if (!ts) return '-'
  const d = new Date(ts * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
    + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

/* ==================== Raw API file type ==================== */

interface ApiWikiFile {
  filename: string
  abs_path: string
  size_bytes: number
  modified: number
  preview: string
  index_status: 'synced' | 'out_of_sync' | 'not_indexed'
}

/* ==================== Reactive state ==================== */

const loading = ref(true)
const loadError = ref(false)
const activeTab = ref<'stats' | 'ops' | 'settings'>('stats')
const indexResultMsg = ref<{ type: 'ok' | 'err'; text: string } | null>(null)
const showProgress = ref(false)
const progressLabel = ref('准备中...')
const progressPct = ref('0%')
const progressPctNum = ref(0)
const logLines = ref<string[]>([])
const logWrapEl = ref<HTMLElement | null>(null)

// Sorting
type SortKey = 'filename' | 'sizeBytes' | 'modified'
const sortKey = ref<SortKey>('modified')
const sortAsc = ref(false)

// Settings form
const formWikiDir = ref('')
const formLightragDir = ref('')
const formLanguage = ref('Chinese')
const formChunkSize = ref(1200)
const formTimeout = ref(30)
const saving = ref(false)

// Copy toast
const copyToastVisible = ref(false)

// Polling
let pollTimer: ReturnType<typeof setInterval> | null = null
let lastDone = -1

// File data stored locally (raw API shape)
const rawFiles = ref<ApiWikiFile[]>([])

/* ==================== Computed ==================== */

const sortedFiles = computed(() => {
  const arr = [...rawFiles.value]
  const key = sortKey.value
  const asc = sortAsc.value
  arr.sort((a, b) => {
    let va: string | number, vb: string | number
    if (key === 'filename') {
      va = a.filename.toLowerCase()
      vb = b.filename.toLowerCase()
    } else if (key === 'sizeBytes') {
      va = a.size_bytes
      vb = b.size_bytes
    } else {
      va = a.modified
      vb = b.modified
    }
    if (va < vb) return asc ? -1 : 1
    if (va > vb) return asc ? 1 : -1
    return 0
  })
  return arr
})

const totalSize = computed(() => rawFiles.value.reduce((s, f) => s + (f.size_bytes || 0), 0))

const indexStatusText = computed(() => {
  if (!store.indexed) return { text: '未索引', color: '#fde047' }
  const out = rawFiles.value.filter(f => f.index_status !== 'synced').length
  if (out > 0) return { text: '需重建 ' + out + ' 个文件', color: '#f97316' }
  return { text: '已同步', color: '#86efac' }
})

const sortArrow = computed(() => (key: SortKey) => {
  if (sortKey.value !== key) return ''
  return sortAsc.value ? ' ▲' : ' ▼'
})

/* ==================== Data loading ==================== */

async function loadFiles(skipRender = false) {
  loading.value = true
  loadError.value = false
  try {
    const data = await fetchJson<{ files: ApiWikiFile[]; indexed: boolean }>('/wiki/list')
    rawFiles.value = Array.isArray(data.files) ? data.files : []
    store.indexed = data.indexed ?? false
  } catch (e) {
    console.error('[WikiView] loadFiles error:', e)
    loadError.value = true
  } finally {
    loading.value = false
  }
}

async function loadSettings() {
  try {
    const data = await fetchJson<any>('/wiki/settings')
    if (data.error) return
    formWikiDir.value = data.wiki_dir || 'wiki'
    formLightragDir.value = data.lightrag_dir || 'rag/lightrag_data'
    formLanguage.value = data.language || 'Chinese'
    formChunkSize.value = data.chunk_token_size || 1200
    formTimeout.value = data.search_timeout || 30
  } catch (e) {
    console.error('[WikiView] loadSettings error:', e)
  }
}

/* ==================== Sorting ==================== */

function doSort(key: SortKey) {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value
  } else {
    sortKey.value = key
    sortAsc.value = true
  }
}

/* ==================== Tab switching ==================== */

function switchTab(tab: 'stats' | 'ops' | 'settings') {
  const prev = activeTab.value
  activeTab.value = tab
  if (tab === 'settings') loadSettings()
  if (tab === 'ops') restoreIndexProgress()
  if (prev === 'ops') stopPoll()
}

/* ==================== Copy path ==================== */

function copyPath(path: string) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(path).then(() => {
      flashCopyToast()
    })
  } else {
    const ta = document.createElement('textarea')
    ta.value = path
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    flashCopyToast()
  }
}

function flashCopyToast() {
  copyToastVisible.value = true
  setTimeout(() => { copyToastVisible.value = false }, 1200)
}

/* ==================== Index progress ==================== */

async function restoreIndexProgress() {
  try {
    const pdata = await fetchJson<{ status: string; done: number; total: number; current_file: string }>('/wiki/index-progress')
    if (pdata.status === 'running') {
      applyProgress(pdata)
      startPoll()
    } else {
      applyDone(pdata)
    }
  } catch (e) {
    console.error('[WikiView] restoreIndexProgress error:', e)
  }
}

function applyProgress(pdata: { done: number; total: number; current_file: string }) {
  showProgress.value = true
  const pct = pdata.total > 0 ? Math.round((pdata.done / pdata.total) * 100) : 0
  progressPctNum.value = pct
  progressPct.value = pct + '%'
  progressLabel.value = (pdata.current_file || '进行中...') + ' (' + pdata.done + '/' + pdata.total + ')'
  lastDone = pdata.done
}

function applyDone(pdata: { status: string; done: number; total: number }) {
  if (pdata.total > 0) {
    const pct = Math.round((pdata.done / pdata.total) * 100)
    progressPctNum.value = pct
    progressPct.value = pct + '%'
  } else {
    progressPctNum.value = 100
    progressPct.value = '100%'
  }
  showProgress.value = false
  indexResultMsg.value = pdata.status === 'done'
    ? { type: 'ok', text: '索引完成' }
    : pdata.status === 'error'
      ? { type: 'err', text: '索引出错' }
      : null
}

function startPoll() {
  if (pollTimer !== null) return
  pollTimer = setInterval(async () => {
    try {
      const pdata = await fetchJson<{ status: string; done: number; total: number; current_file: string }>('/wiki/index-progress')
      if (pdata.status === 'running') {
        applyProgress(pdata)
        await refreshLog()
        if (pdata.done !== lastDone) {
          lastDone = pdata.done
          await loadFiles(true)
        }
      } else {
        lastDone = -1
        stopPoll()
        applyDone(pdata)
        await loadFiles(true)
        await nextTick()
        scrollLogBottom()
      }
    } catch (e) {
      console.error('[WikiView] poll error:', e)
    }
  }, 500)
}

function stopPoll() {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function refreshLog() {
  try {
    const data = await fetchJson<{ lines: string[] }>('/wiki/index-log?lines=20')
    if (data.lines) {
      logLines.value = data.lines
      await nextTick()
      scrollLogBottom()
    }
  } catch {
    // 日志获取失败不阻塞
  }
}

function scrollLogBottom() {
  if (logWrapEl.value) {
    logWrapEl.value.scrollTop = logWrapEl.value.scrollHeight
  }
}

/* ==================== Rebuild index ==================== */

async function rebuildIndex() {
  indexResultMsg.value = null
  showProgress.value = true
  progressPctNum.value = 0
  progressPct.value = '0%'
  progressLabel.value = '准备中...'
  lastDone = 0

  try {
    const resp = await fetchJson<any>('/wiki/index')
    if (resp.error) {
      showProgress.value = false
      indexResultMsg.value = { type: 'err', text: '索引失败: ' + resp.error }
      return
    }
    startPoll()
  } catch (e: any) {
    showProgress.value = false
    indexResultMsg.value = { type: 'err', text: '请求失败: ' + (e.message || String(e)) }
  }
}

/* ==================== Save settings ==================== */

async function saveSettings() {
  saving.value = true
  const payload = {
    wiki_dir: formWikiDir.value.trim(),
    lightrag_dir: formLightragDir.value.trim(),
    language: formLanguage.value,
    chunk_token_size: parseInt(String(formChunkSize.value)) || 1200,
    search_timeout: parseInt(String(formTimeout.value)) || 30,
  }
  try {
    const data = await postJson<any>('/wiki/settings', payload)
    if (data.ok) {
      toast.show('设置已保存')
      await loadFiles()
    } else {
      toast.show('保存失败: ' + (data.error || '未知错误'), 'error')
    }
  } catch (e: any) {
    toast.show('请求失败: ' + (e.message || String(e)), 'error')
  } finally {
    saving.value = false
  }
}

/* ==================== Lifecycle ==================== */

onMounted(async () => {
  console.log('[WikiView] mounted')
  await loadSettings()
  await loadFiles()
  restoreIndexProgress()
})

onUnmounted(() => {
  stopPoll()
})
</script>

<template>
  <div class="wiki-wrap">
    <!-- Copy toast -->
    <Transition name="toast-fade">
      <div v-if="copyToastVisible" class="copy-toast">路径已复制</div>
    </Transition>

    <div class="wiki-header">
      <div class="wiki-title">Wiki 知识库</div>
    </div>

    <!-- Two-column layout -->
    <div class="wiki-body">
      <!-- Left: Main content -->
      <div class="wiki-main">
        <div class="file-section">
          <div class="fs-header">
            <div class="fs-title">文件列表</div>
            <span class="ft-meta">{{ rawFiles.length }} 个文件</span>
          </div>
          <div class="table-wrap">
            <!-- Loading -->
            <div v-if="loading && rawFiles.length === 0" class="mini-loading"></div>
            <!-- Error -->
            <div v-else-if="loadError" class="empty-state">加载失败，请检查后端连接</div>
            <!-- Empty -->
            <div v-else-if="rawFiles.length === 0" class="empty-state">Wiki 目录为空</div>
            <!-- File table -->
            <table v-else class="file-table">
              <thead>
                <tr>
                  <th style="width:40px"></th>
                  <th @click="doSort('filename')">文件名{{ sortArrow('filename') }}</th>
                  <th @click="doSort('sizeBytes')">大小{{ sortArrow('sizeBytes') }}</th>
                  <th @click="doSort('modified')">修改时间{{ sortArrow('modified') }}</th>
                  <th>预览</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="f in sortedFiles"
                  :key="f.abs_path"
                  style="cursor:pointer"
                  @click="copyPath(f.abs_path || f.filename)"
                >
                  <td style="text-align:center">
                    <span v-if="f.index_status === 'synced'" style="color:#22c55e" title="已同步">&#10003;</span>
                    <span v-else-if="f.index_status === 'out_of_sync'" style="color:#f97316" title="文件已修改，需重建索引">&#9888;</span>
                    <span v-else style="color:#94a3b8" title="未索引">&#9675;</span>
                  </td>
                  <td class="ft-name">{{ f.filename }}</td>
                  <td class="ft-meta">{{ formatSize(f.size_bytes) }}</td>
                  <td class="ft-meta">{{ formatDate(f.modified) }}</td>
                  <td class="ft-preview" :title="f.preview">{{ f.preview || '' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Right: Info sidebar -->
      <div class="wiki-sidebar">
        <!-- Sidebar nav tabs -->
        <div class="side-tab-bar">
          <button
            class="side-tab-btn"
            :class="{ active: activeTab === 'stats' }"
            @click="switchTab('stats')"
          >统计</button>
          <button
            class="side-tab-btn"
            :class="{ active: activeTab === 'ops' }"
            @click="switchTab('ops')"
          >操作</button>
          <button
            class="side-tab-btn"
            :class="{ active: activeTab === 'settings' }"
            @click="switchTab('settings')"
          >设置</button>
        </div>

        <div class="side-content">
          <!-- Stats panel -->
          <div v-show="activeTab === 'stats'" class="side-panel active">
            <div class="wscard-col">
              <div class="wscard">
                <div class="wsc-label">文件数</div>
                <div class="wsc-value">{{ rawFiles.length || '-' }}</div>
              </div>
              <div class="wscard">
                <div class="wsc-label">总大小</div>
                <div class="wsc-value">{{ rawFiles.length ? formatSize(totalSize) : '-' }}</div>
                <div class="wsc-sub">{{ rawFiles.length }} 个 .md 文件</div>
              </div>
              <div class="wscard">
                <div class="wsc-label">索引状态</div>
                <div class="wsc-value" :style="{ fontSize: '15px', color: indexStatusText.color }">
                  {{ indexStatusText.text }}
                </div>
              </div>
            </div>
          </div>

          <!-- Ops panel -->
          <div v-show="activeTab === 'ops'" class="side-panel active">
            <div class="ops-section">
              <div class="ops-title">快捷操作</div>
              <div class="ops-list">
                <button class="ops-btn" :disabled="showProgress" @click="rebuildIndex">
                  <span class="ops-icon">&#x21bb;</span>
                  <span class="ops-text">{{ showProgress ? '索引中...' : '重建索引' }}</span>
                </button>
              </div>
              <!-- Index result message -->
              <div
                v-if="indexResultMsg"
                class="index-result"
                :class="indexResultMsg.type"
              >{{ indexResultMsg.text }}</div>
              <!-- Progress -->
              <div v-if="showProgress" style="display:flex;flex-direction:column;flex:1;min-height:0;margin-top:8px">
                <div class="progress-label">{{ progressLabel }}</div>
                <div class="progress-bar-bg">
                  <div class="progress-bar-fill" :style="{ width: progressPct }"></div>
                </div>
                <div class="progress-pct">{{ progressPct }}</div>
                <div ref="logWrapEl" class="index-log-wrap" style="margin-top:8px">
                  <div v-for="(line, i) in logLines" :key="i" class="log-line">{{ line }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Settings panel -->
          <div v-show="activeTab === 'settings'" class="side-panel active">
            <div class="settings-section">
              <div class="form-group">
                <label class="form-label">Wiki 目录</label>
                <input v-model="formWikiDir" class="form-input" type="text" placeholder="如: wiki">
              </div>
              <div class="form-group">
                <label class="form-label">LightRAG 数据目录</label>
                <input v-model="formLightragDir" class="form-input" type="text" placeholder="如: rag/lightrag_data">
              </div>
              <div class="form-group">
                <label class="form-label">语言</label>
                <select v-model="formLanguage" class="form-select">
                  <option value="Chinese">Chinese</option>
                  <option value="English">English</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">分块大小 (token)</label>
                <input v-model.number="formChunkSize" class="form-input" type="number" placeholder="1200" min="200" max="8000">
              </div>
              <div class="form-group">
                <label class="form-label">搜索超时 (秒)</label>
                <input v-model.number="formTimeout" class="form-input" type="number" placeholder="30" min="5" max="300">
              </div>
              <button class="btn-save" :disabled="saving" @click="saveSettings">
                {{ saving ? '保存中...' : '保存设置' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* === Layout === */
.wiki-wrap {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-sizing: border-box;
  height: 100%;
  overflow: hidden;
}
.wiki-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.wiki-title {
  font-size: 18px;
  font-weight: 700;
}

/* Two-column body */
.wiki-body {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.wiki-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* === Right Sidebar === */
.wiki-sidebar {
  width: 300px;
  min-width: 260px;
  flex-shrink: 0;
  background: #1a1d27;
  border: 1px solid #2d3149;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.side-tab-bar {
  display: flex;
  background: #12141c;
  border-bottom: 1px solid #2d3149;
  padding: 4px;
  flex-shrink: 0;
}
.side-tab-btn {
  flex: 1;
  padding: 7px 0;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all .15s;
  user-select: none;
  border: none;
  background: transparent;
  color: #64748b;
  text-align: center;
}
.side-tab-btn:hover {
  color: #94a3b8;
}
.side-tab-btn.active {
  background: #7c3aed33;
  color: #a78bfa;
}

.side-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.side-panel {
  display: none;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  padding: 14px;
}
.side-panel.active {
  display: flex;
}

/* === Stats Cards === */
.wscard-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.wscard {
  background: #12141c;
  border: 1px solid #2d3149;
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.wsc-label {
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: .06em;
  font-weight: 600;
}
.wsc-value {
  font-size: 22px;
  font-weight: 700;
  color: #e2e8f0;
}
.wsc-sub {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}

/* === Ops Panel === */
.ops-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ops-title {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
}
.ops-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ops-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  background: #12141c;
  border: 1px solid #2d3149;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all .15s;
  user-select: none;
}
.ops-btn:hover {
  background: #1e293b;
  color: #e2e8f0;
  border-color: #7c3aed44;
}
.ops-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.ops-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}
.ops-text {
  white-space: nowrap;
}

/* === Index Result === */
.index-result {
  font-size: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  line-height: 1.6;
}
.index-result.ok {
  background: #22c55e11;
  color: #86efac;
  border: 1px solid #22c55e22;
}
.index-result.err {
  background: #ef444411;
  color: #fca5a5;
  border: 1px solid #ef444422;
}

/* === File Table === */
.file-section {
  background: #1a1d27;
  border: 1px solid #2d3149;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
}
.fs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.fs-title {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
}
.table-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.file-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.file-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #12141c;
  color: #64748b;
  font-size: 11px;
  font-weight: 600;
  text-align: left;
  padding: 8px 12px;
  border-bottom: 1px solid #2d3149;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
}
.file-table th:hover {
  color: #94a3b8;
}
.file-table td {
  padding: 8px 12px;
  border-bottom: 1px solid #1a1d27;
  vertical-align: top;
}
.file-table tbody tr:hover {
  background: #12141c;
}
.ft-name {
  color: #a78bfa;
  font-weight: 500;
  white-space: nowrap;
}
.ft-meta {
  color: #64748b;
  white-space: nowrap;
  font-size: 12px;
}
.ft-preview {
  color: #94a3b8;
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

/* === Settings Panel === */
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

/* === Form Elements === */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.form-label {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
}
.form-input,
.form-select {
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid #2d3149;
  background: #12141c;
  color: #e2e8f0;
  font-size: 13px;
  outline: none;
  transition: border-color .2s;
}
.form-input:focus,
.form-select:focus {
  border-color: #7c3aed;
}

/* === Buttons === */
.btn-save {
  padding: 8px 24px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all .2s;
  border: none;
  user-select: none;
  background: #7c3aed33;
  color: #a78bfa;
  border: 1px solid #7c3aed44;
}
.btn-save:hover {
  background: #7c3aed55;
}
.btn-save:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* === Misc === */
.mini-loading {
  display: block;
  width: 24px;
  height: 24px;
  border: 2px solid #eab30844;
  border-top-color: #fde047;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 24px auto;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  color: #64748b;
  padding: 40px 20px;
  font-size: 13px;
}

.copy-toast {
  position: fixed;
  top: 36px;
  left: 50%;
  transform: translateX(-50%);
  background: #22c55e22;
  color: #86efac;
  border: 1px solid #22c55e44;
  font-size: 11px;
  padding: 4px 16px;
  border-radius: 6px;
  pointer-events: none;
  z-index: 100;
}

.toast-fade-enter-active {
  animation: toastIn 0.2s ease;
}
.toast-fade-leave-active {
  animation: toastOut 1s ease forwards;
}
@keyframes toastIn {
  from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
  to   { opacity: 1; transform: translateX(-50%); }
}
@keyframes toastOut {
  0%   { opacity: 1; transform: translateX(-50%); }
  100% { opacity: 0; transform: translateX(-50%) translateY(12px); }
}

.progress-label {
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.progress-bar-bg {
  background: #0f1117;
  border: 1px solid #2d3149;
  border-radius: 4px;
  height: 20px;
  overflow: hidden;
  position: relative;
}
.progress-bar-fill {
  height: 100%;
  background-color: #7c3aed;
  background-image: linear-gradient(
    90deg,
    rgba(255,255,255,0) 0%,
    rgba(255,255,255,.2) 50%,
    rgba(255,255,255,0) 100%
  );
  border-radius: 4px;
  transition: width 0.4s ease;
  position: relative;
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
.progress-pct {
  font-size: 10px;
  font-weight: 700;
  color: #94a3b8;
  text-align: right;
  margin-top: 4px;
}
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.index-log-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: #0f1117;
  border: 1px solid #2d3149;
  border-radius: 4px;
  padding: 6px 8px;
  font-family: monospace;
  font-size: 10px;
  color: #94a3b8;
  line-height: 1.5;
  word-break: break-all;
}
.index-log-wrap .log-line {
  opacity: .7;
}
.index-log-wrap .log-line:last-child {
  opacity: 1;
  color: #e2e8f0;
}
</style>

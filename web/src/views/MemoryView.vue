<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { useToast } from '@/composables/useToast'

const { fetchJson, postJson } = useApi()
const toast = useToast()

/* ==================== Types ==================== */
interface Memory {
  id: string
  text: string
  timestamp: string
  score?: number
}

interface OrganizeGroup {
  similarity: number
  memories: Memory[]
}

interface RefinedItem {
  group_id: number
  original_ids: string[]
  refined_text: string
  category: string
  refined: boolean
}

/* ==================== State ==================== */
const allMemories = ref<Memory[]>([])
const searchResults = ref<Memory[]>([])
const activeQuery = ref('')
const currentTab = ref('search')
const searchHistory = ref<string[]>([])
const searchInput = ref('')
const storeInput = ref('')
const showHistoryDropdown = ref(false)
const animatingCount = ref(0)

// Organize state
const organizeGroups = ref<OrganizeGroup[]>([])
const organizeRefined = ref<RefinedItem[]>([])
const organizeBusy = ref(false)
const appliedGroupIds = ref<number[]>([])
const dedupThreshold = ref('0.85')

let searchTimer: ReturnType<typeof setTimeout> | null = null

/* ==================== Computed ==================== */
const unrefinedCount = computed(() => {
  let c = 0
  for (let i = 0; i < organizeGroups.value.length; i++) {
    if (!organizeRefined.value.some(r => r.group_id === i)) c++
  }
  return c
})

/* ==================== API helper ==================== */
async function api<T>(path: string, data: any): Promise<T> {
  return postJson<T>(path, data)
}

/* ==================== Animate count ==================== */
function animateCount(target: number) {
  const current = animatingCount.value
  if (current === target) return
  const diff = target - current
  const step = Math.max(1, Math.ceil(Math.abs(diff) / 10))
  const iv = setInterval(() => {
    const now = animatingCount.value
    const delta = target > now ? Math.min(step, target - now) : Math.max(-step, target - now)
    if (now === target || (delta > 0 ? now >= target : now <= target)) {
      animatingCount.value = target
      clearInterval(iv)
    } else {
      animatingCount.value = now + delta
    }
  }, 50)
}

/* ==================== Format time ==================== */
function formatTime(ts: string): string {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ts.slice(0, 16)
  }
}

/* ==================== Tab switching ==================== */
function switchTab(tab: string) {
  currentTab.value = tab
  if (tab === 'store') loadAll()
}

/* ==================== Load all memories ==================== */
async function loadAll() {
  updateStats()
  try {
    const r = await api<{ memories: Memory[] }>('/list', {})
    allMemories.value = r.memories || []
    if (activeQuery.value) searchMemory()
  } catch (e) {
    console.error('[memory] loadAll error:', e)
  }
}

/* ==================== Update stats ==================== */
async function updateStats() {
  try {
    const r = await fetchJson<{ count: number }>('/memory-count')
    animateCount(r.count || 0)
  } catch {
    animatingCount.value = allMemories.value.length
  }
}

/* ==================== Search ==================== */
function debounceSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(searchMemory, 500)
}

async function searchMemory() {
  const query = searchInput.value.trim()
  if (!query) return
  activeQuery.value = query
  try {
    const r = await api<{ results: Memory[] }>('/search', { query })
    searchResults.value = r.results || []
    loadSearchHistory()
  } catch {
    toast.show('搜索失败', 'error')
  }
}

function searchFromHistory(query: string) {
  searchInput.value = query
  showHistoryDropdown.value = false
  searchMemory()
}

/* ==================== Store memory ==================== */
async function storeMemory() {
  const text = storeInput.value.trim()
  if (!text) return
  try {
    const r = await api<{ result?: string; error?: string }>('/store', { text })
    if (r.error) { toast.show(r.error, 'error'); return }
    toast.show(r.result || '保存成功')
    storeInput.value = ''
    loadAll()
  } catch {
    toast.show('连接失败', 'error')
  }
}

/* ==================== Delete memory ==================== */
async function deleteMemory(id: string) {
  try {
    const r = await api<{ result?: string; error?: string }>('/delete', { memory_id: id })
    if (r.error) { toast.show(r.error, 'error'); return }
    toast.show(r.result || '删除成功')
    allMemories.value = allMemories.value.filter(m => m.id !== id)
    searchResults.value = searchResults.value.filter(m => m.id !== id)
    updateStats()
  } catch {
    toast.show('删除失败', 'error')
  }
}

/* ==================== Search history ==================== */
async function loadSearchHistory() {
  try {
    const r = await fetchJson<{ history: { query: string }[] }>('/search-history')
    searchHistory.value = (r.history || []).map(h => h.query)
  } catch (e) {
    console.error(e)
  }
}

async function clearSearchHistory() {
  try {
    await fetch('/search-history', { method: 'DELETE' })
    searchHistory.value = []
  } catch (e) {
    console.error(e)
  }
}

/* ==================== Organize ==================== */
async function startOrganize() {
  if (organizeBusy.value) return
  organizeBusy.value = true
  const threshold = parseFloat(dedupThreshold.value) || 0.85
  try {
    const r = await api<{ groups: OrganizeGroup[]; total_memories: number; grouped_count: number; error?: string }>('/organize/dedup', { similarity_threshold: threshold })
    if (r.error) {
      toast.show(r.error, 'error')
      organizeBusy.value = false
      return
    }
    organizeGroups.value = r.groups || []
    organizeRefined.value = []
    appliedGroupIds.value = []
    if (!organizeGroups.value.length) {
      toast.show('没有发现重复的记忆（共 ' + (r.total_memories || 0) + ' 条）')
    }
  } catch (e: any) {
    toast.show('请求失败: ' + e.message, 'error')
  } finally {
    organizeBusy.value = false
  }
}

async function refineGroup(groupIndex: number) {
  if (!organizeGroups.value[groupIndex]) return
  if (organizeRefined.value.some(r => r.group_id === groupIndex)) {
    toast.show('该组已精炼', 'info')
    return
  }
  try {
    const r = await api<{ refined: RefinedItem[]; error?: string }>('/organize/refine', { groups: [organizeGroups.value[groupIndex]] })
    if (r.error) { toast.show('精炼失败: ' + r.error, 'error'); return }
    const newRefined = (r.refined || []).map(item => ({ ...item, group_id: groupIndex }))
    organizeRefined.value = [...organizeRefined.value, ...newRefined]
  } catch (e: any) {
    toast.show('精炼失败: ' + e.message, 'error')
  }
}

function refineAllGroups() {
  if (!organizeGroups.value.length) return
  const unrefined = []
  for (let i = 0; i < organizeGroups.value.length; i++) {
    if (!organizeRefined.value.some(r => r.group_id === i)) unrefined.push(i)
  }
  if (!unrefined.length) { toast.show('所有组已精炼', 'info'); return }
  unrefined.forEach(idx => refineGroup(idx))
}

function isGroupApplied(gi: number): boolean {
  return appliedGroupIds.value.includes(gi)
}

function isGroupRefined(gi: number): boolean {
  return organizeRefined.value.some(r => r.group_id === gi)
}

async function applySingleRefine(refineIndex: number) {
  const item = organizeRefined.value[refineIndex]
  if (!item) return
  const el = document.getElementById('refinedText' + refineIndex)
  const newText = el ? (el as HTMLElement).innerText.trim() : item.refined_text
  if (!newText) { toast.show('精炼内容为空', 'error'); return }
  try {
    const r = await api<{ error?: string }>('/organize/apply', {
      items: [{ delete_ids: item.original_ids, new_text: newText, category: item.category || 'reference' }]
    })
    if (r.error) { toast.show('写入失败: ' + r.error, 'error'); return }
    toast.show('已合并该组记忆（删除 ' + item.original_ids.length + ' 条，新增 1 条）')
    const gid = item.group_id
    organizeRefined.value = organizeRefined.value.filter((_, i) => i !== refineIndex)
    if (!appliedGroupIds.value.includes(gid)) appliedGroupIds.value.push(gid)
    if (!organizeRefined.value.length && organizeGroups.value.length) {
      if (appliedGroupIds.value.length === organizeGroups.value.length) {
        organizeGroups.value = []
        organizeRefined.value = []
        appliedGroupIds.value = []
        loadAll()
      }
    }
  } catch (e: any) {
    toast.show('写入失败: ' + e.message, 'error')
  }
}

async function applyOrganize() {
  if (!organizeRefined.value.length) return
  const items: { delete_ids: string[]; new_text: string; category: string }[] = []
  for (let i = 0; i < organizeRefined.value.length; i++) {
    const check = document.getElementById('refinedCheck' + i) as HTMLInputElement
    if (!check || !check.checked) continue
    const el = document.getElementById('refinedText' + i)
    const newText = el ? (el as HTMLElement).innerText.trim() : organizeRefined.value[i].refined_text
    if (!newText) continue
    items.push({ delete_ids: organizeRefined.value[i].original_ids, new_text: newText, category: organizeRefined.value[i].category || 'reference' })
  }
  if (!items.length) { toast.show('没有勾选任何项', 'error'); return }
  try {
    const r = await api<{ applied: number; deleted: number; added: number; error?: string }>('/organize/apply', { items })
    if (r.error) { toast.show('写入失败: ' + r.error, 'error'); return }
    toast.show('已合并 ' + r.applied + ' 组记忆（删除 ' + r.deleted + ' 条，新增 ' + r.added + ' 条）')
    organizeGroups.value = []
    organizeRefined.value = []
    appliedGroupIds.value = []
    loadAll()
  } catch (e: any) {
    toast.show('写入失败: ' + e.message, 'error')
  }
}

/* ==================== Click outside to close history ==================== */
function onDocumentClick(e: MouseEvent) {
  const wrap = document.querySelector('.search-history-wrap')
  if (wrap && !wrap.contains(e.target as Node)) showHistoryDropdown.value = false
}

/* ==================== Lifecycle ==================== */
onMounted(() => {
  console.log('[MemoryView] mounted')
  loadAll()
  loadSearchHistory()
  document.addEventListener('click', onDocumentClick)
})

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
  document.removeEventListener('click', onDocumentClick)
})
</script>

<template>
  <div class="memory-layout">
    <!-- Top nav -->
    <nav class="memory-nav">
      <div class="nav-tabs">
        <button class="nav-tab" :class="{ active: currentTab === 'search' }" @click="switchTab('search')">搜索记忆</button>
        <button class="nav-tab" :class="{ active: currentTab === 'store' }" @click="switchTab('store')">保存记忆</button>
        <button class="nav-tab" :class="{ active: currentTab === 'organize' }" @click="switchTab('organize')">整理记忆</button>
      </div>
      <div class="nav-stat">
        <span class="stat-value">{{ animatingCount }}</span>
        <span class="stat-label">条记忆</span>
        <button class="btn-icon" @click="loadAll()" title="刷新">↻</button>
      </div>
    </nav>

    <!-- Search panel -->
    <div v-show="currentTab === 'search'" class="tab-panel">
      <div class="search-bar">
        <input
          v-model="searchInput"
          type="text"
          placeholder="搜索相关记忆..."
          @input="debounceSearch"
          @keydown.enter="searchMemory"
        />
        <button class="btn btn-primary" @click="searchMemory">搜索</button>
        <div class="search-history-wrap">
          <button class="btn-icon" @click.stop="showHistoryDropdown = !showHistoryDropdown" title="搜索历史">🕐</button>
          <div v-show="showHistoryDropdown" class="sh-dropdown">
            <div class="sh-dropdown-header">
              <span>搜索历史</span>
              <button class="sh-clear" @click="clearSearchHistory">清空</button>
            </div>
            <div class="sh-dropdown-list">
              <div v-if="!searchHistory.length" class="sh-empty">暂无搜索历史</div>
              <div
                v-for="h in searchHistory"
                :key="h"
                class="history-item"
                @click="searchFromHistory(h)"
              >{{ h }}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="memory-list-container">
        <div class="memory-list">
          <template v-if="activeQuery">
            <template v-if="searchResults.length">
              <div v-for="m in searchResults" :key="m.id" class="memory-card search-result">
                <div class="memory-content">
                  <div class="memory-text">{{ m.text }}</div>
                  <div class="memory-meta">
                    <span class="memory-time">{{ formatTime(m.timestamp) }}</span>
                    <span v-if="m.score !== undefined" class="memory-score">相似度 {{ (m.score * 100).toFixed(1) }}%</span>
                    <span class="memory-id">{{ (m.id || '').slice(0, 8) }}...</span>
                  </div>
                </div>
                <button class="del-btn" @click="deleteMemory(m.id)" title="删除">✕</button>
              </div>
            </template>
            <div v-else class="empty">
              <div class="empty-icon">🔍</div>
              <div class="empty-text">没有找到相关记忆</div>
            </div>
          </template>
          <div v-else class="empty">
            <div class="empty-icon">🔍</div>
            <div class="empty-text">搜索记忆以查看结果</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Store panel -->
    <div v-show="currentTab === 'store'" class="tab-panel">
      <div class="store-area">
        <textarea
          v-model="storeInput"
          placeholder="输入要记住的内容..."
          @keydown.ctrl.enter="storeMemory"
        ></textarea>
        <button class="btn btn-primary" @click="storeMemory">保存记忆</button>
      </div>
      <div class="memory-list-container">
        <div class="memory-list">
          <template v-if="allMemories.length">
            <div v-for="m in allMemories" :key="m.id" class="memory-card">
              <div class="memory-content">
                <div class="memory-text">{{ m.text }}</div>
                <div class="memory-meta">
                  <span class="memory-time">{{ formatTime(m.timestamp) }}</span>
                  <span class="memory-id">{{ (m.id || '').slice(0, 8) }}...</span>
                </div>
              </div>
              <button class="del-btn" @click="deleteMemory(m.id)" title="删除">✕</button>
            </div>
          </template>
          <div v-else class="empty">
            <div class="empty-icon">🧠</div>
            <div class="empty-text">还没有任何记忆</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Organize panel -->
    <div v-show="currentTab === 'organize'" class="tab-panel">
      <div class="organize-toolbar">
        <select v-model="dedupThreshold" class="organize-select">
          <option value="0.90">严格去重</option>
          <option value="0.85">中等去重</option>
          <option value="0.80">宽松去重</option>
        </select>
        <button class="btn btn-accent" :disabled="organizeBusy" @click="startOrganize">
          {{ organizeBusy ? '分析中...' : '开始分析' }}
        </button>
      </div>
      <div class="memory-list-container">
        <!-- Organize content -->
        <template v-if="organizeBusy">
          <div class="organize-loading">正在分析记忆相似度...</div>
        </template>
        <template v-else-if="organizeGroups.length">
          <div class="organize-header">
            <span>共发现 {{ organizeGroups.length }} 组相似</span>
          </div>
          <div class="organize-groups">
            <div
              v-for="(g, gi) in organizeGroups"
              :key="gi"
              class="organize-group-card"
              :class="{ 'og-applied': isGroupApplied(gi) }"
            >
              <div class="og-label">
                组 {{ gi + 1 }} · 相似度 {{ g.similarity }} · {{ g.memories.length }} 条
                <button
                  v-if="isGroupApplied(gi)"
                  class="btn-secondary-sm og-refine-btn"
                  disabled
                >已写入</button>
                <button
                  v-else-if="isGroupRefined(gi)"
                  class="btn-secondary-sm og-refine-btn"
                  disabled
                >已精炼</button>
                <button
                  v-else
                  class="btn-secondary-sm og-refine-btn"
                  @click="refineGroup(gi)"
                >精炼此组</button>
              </div>
              <div v-for="(m, mi) in g.memories" :key="mi" class="og-item">
                <span class="og-idx">{{ mi + 1 }}</span>
                {{ m.text }}
              </div>

              <!-- Refined result for this group -->
              <template v-for="(item, ri) in organizeRefined" :key="ri">
                <div v-if="item.group_id === gi" class="og-refine-result">
                  <div class="og-refine-divider"></div>
                  <div class="og-refine-label" :class="{ refined: item.refined }">
                    精炼结果{{ item.refined ? '' : '（降级）' }}
                  </div>
                  <div
                    class="organize-refined-text"
                    contenteditable="true"
                    :id="'refinedText' + ri"
                  >{{ item.refined_text }}</div>
                  <div class="organize-category">分类: {{ item.category || 'unknown' }}</div>
                  <div class="og-refine-actions">
                    <div class="organize-check">
                      <input type="checkbox" :id="'refinedCheck' + ri" checked />
                      <label :for="'refinedCheck' + ri">确认合并</label>
                    </div>
                    <button class="btn btn-sm btn-primary" @click="applySingleRefine(ri)">确认修改</button>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <!-- Footer -->
          <div v-if="organizeRefined.length" class="organize-refined">
            <div class="organize-footer-bar">
              <span class="organize-footer-stat">已精炼 {{ organizeRefined.length }}/{{ organizeGroups.length }} 组</span>
              <div class="organize-actions">
                <button v-if="unrefinedCount > 0" class="btn-secondary-sm" @click="refineAllGroups">
                  精炼剩余 {{ unrefinedCount }} 组
                </button>
                <button class="btn btn-sm btn-primary" @click="applyOrganize">确认写入</button>
              </div>
            </div>
          </div>
        </template>
        <div v-else class="empty">
          <div class="empty-icon">🧹</div>
          <div class="empty-text">点击"开始分析"扫描重复记忆</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.memory-layout { display: flex; flex-direction: column; padding: 20px 24px; overflow: hidden; flex: 1; min-height: 0; box-sizing: border-box; height: 100%; gap: 16px; }

.memory-nav { display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
.nav-tabs { display: flex; gap: 4px; background: #1a1d27; border-radius: 10px; padding: 4px; }
.nav-tab { padding: 8px 20px; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; color: #94a3b8; background: transparent; transition: all .2s; }
.nav-tab:hover { color: #e2e8f0; }
.nav-tab.active { background: #7c3aed; color: #fff; }
.nav-stat { display: flex; align-items: center; gap: 8px; }
.nav-stat .stat-value { font-size: 18px; font-weight: 700; color: #a78bfa; }
.nav-stat .stat-label { font-size: 12px; color: #64748b; }
.btn-icon { background: none; border: 1px solid #2d3149; color: #94a3b8; cursor: pointer; font-size: 14px; padding: 4px 10px; border-radius: 6px; transition: all .2s; }
.btn-icon:hover { color: #e2e8f0; border-color: #475569; }

.tab-panel { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 12px; overflow: hidden; }

.search-bar { display: flex; gap: 8px; flex-shrink: 0; }
.search-bar input { flex: 1; background: #1a1d27; border: 1px solid #2d3149; border-radius: 8px; color: #e2e8f0; padding: 10px 14px; font-size: 14px; outline: none; transition: border-color .2s; }
.search-bar input:focus { border-color: #7c3aed; }
.search-history-wrap { position: relative; flex-shrink: 0; }
.sh-dropdown { position: absolute; right: 0; top: 100%; margin-top: 6px; width: 280px; background: #1a1d27; border: 1px solid #2d3149; border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,.4); z-index: 100; overflow: hidden; }
.sh-dropdown-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid #2d3149; }
.sh-dropdown-header span { font-size: 12px; font-weight: 600; color: #94a3b8; }
.sh-clear { background: none; border: none; color: #64748b; font-size: 11px; cursor: pointer; }
.sh-clear:hover { color: #ef4444; }
.sh-dropdown-list { max-height: 240px; overflow-y: auto; padding: 6px; }
.sh-dropdown-list .history-item { padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; color: #94a3b8; transition: background .15s, color .15s; }
.sh-dropdown-list .history-item:hover { background: #2d3149; color: #e2e8f0; }
.sh-empty { padding: 20px; text-align: center; color: #475569; font-size: 12px; }

.store-area { display: flex; gap: 8px; flex-shrink: 0; }
.store-area textarea { flex: 1; background: #1a1d27; border: 1px solid #2d3149; border-radius: 8px; color: #e2e8f0; padding: 10px 14px; font-size: 14px; outline: none; resize: none; height: 60px; font-family: inherit; transition: border-color .2s; }
.store-area textarea:focus { border-color: #7c3aed; }

.organize-toolbar { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
.organize-select { background: #1a1d27; border: 1px solid #2d3149; color: #e2e8f0; padding: 8px 12px; border-radius: 8px; font-size: 13px; outline: none; }

.memory-list-container { flex: 1; overflow-y: auto; min-height: 0; position: relative; }
.memory-list { display: flex; flex-direction: column; gap: 8px; min-height: 0; }

.btn { padding: 9px 14px; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity .2s, transform .1s; }
.btn:active { transform: scale(.98); }
.btn-primary { background: #7c3aed; color: #fff; }
.btn-primary:hover { opacity: .85; }
.btn-accent { background: #10b981; color: #fff; }
.btn-accent:hover { opacity: .85; }
.btn-sm { padding: 6px 12px; font-size: 12px; }
.btn-secondary-sm { padding: 6px 12px; font-size: 12px; background: #1e293b; color: #94a3b8; border: 1px solid #2d3149; border-radius: 6px; cursor: pointer; }
.btn-secondary-sm:hover { border-color: #475569; }

.memory-card { background: #1a1d27; border: 1px solid #2d3149; border-radius: 10px; padding: 14px 16px; display: flex; align-items: flex-start; gap: 12px; transition: border-color .2s; }
.memory-card:hover { border-color: #7c3aed44; }
.memory-card.search-result { border-color: #7c3aed66; }
.memory-content { flex: 1; min-width: 0; }
.memory-text { font-size: 14px; color: #e2e8f0; line-height: 1.5; word-break: break-all; }
.memory-meta { margin-top: 6px; display: flex; align-items: center; gap: 10px; }
.memory-time { font-size: 11px; color: #64748b; }
.memory-score { font-size: 11px; background: #7c3aed22; color: #a78bfa; padding: 1px 7px; border-radius: 99px; font-weight: 600; }
.memory-id { font-size: 10px; color: #374151; font-family: monospace; }
.del-btn { background: none; border: none; color: #374151; cursor: pointer; font-size: 16px; padding: 2px 6px; border-radius: 4px; transition: color .2s, background .2s; flex-shrink: 0; }
.del-btn:hover { color: #ef4444; background: #ef444420; }

.empty { text-align: center; padding: 60px 20px; color: #64748b; }
.empty-icon { font-size: 40px; margin-bottom: 12px; }
.empty-text { font-size: 14px; }

.organize-groups, .organize-refined { display: flex; flex-direction: column; gap: 10px; }
.organize-group-card { background: #1a1d27; border: 1px solid #2d3149; border-radius: 8px; padding: 12px; }
.organize-group-card .og-label { font-size: 11px; color: #64748b; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between; }
.organize-group-card .og-item { font-size: 13px; color: #e2e8f0; padding: 4px 0; border-bottom: 1px solid #12141c; display: flex; gap: 8px; }
.organize-group-card .og-item:last-child { border-bottom: none; }
.og-idx { color: #64748b; font-size: 11px; font-weight: 600; min-width: 18px; flex-shrink: 0; }
.og-refine-btn { font-size: 11px; padding: 3px 10px; }
.organize-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 8px 0; }
.organize-header > span { font-size: 14px; font-weight: 600; color: #a78bfa; }
.organize-actions { display: flex; align-items: center; gap: 8px; }
.og-refine-result { margin-top: 8px; }
.og-refine-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; }
.organize-group-card.og-applied { opacity: 0.5; }
.organize-group-card.og-applied .og-item { text-decoration: line-through; }
.og-refine-divider { border-top: 1px dashed #2d3149; margin: 8px 0; }
.og-refine-label { font-size: 11px; font-weight: 600; color: #10b981; margin-bottom: 4px; }
.og-refine-label:not(.refined) { color: #f59e0b; }
.organize-refined-text { background: #0f1117; border: 1px solid #2d3149; border-radius: 6px; padding: 8px 10px; font-size: 13px; color: #e2e8f0; line-height: 1.5; min-height: 40px; }
.organize-refined-text[contenteditable]:focus { border-color: #7c3aed; outline: none; }
.organize-category { font-size: 11px; color: #a78bfa; margin-top: 4px; }
.organize-check { display: flex; align-items: center; gap: 6px; padding: 4px 0; }
.organize-check input { width: auto; }
.organize-check label { font-size: 12px; color: #94a3b8; cursor: pointer; }
.organize-loading { text-align: center; padding: 40px; color: #64748b; font-size: 14px; }
.organize-footer-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-top: 1px solid #2d3149; margin-top: 8px; position: sticky; bottom: 0; background: #0f1117; }
.organize-footer-stat { font-size: 13px; color: #a78bfa; font-weight: 600; }
</style>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePolling } from '@/composables/usePolling'

interface StreamItem {
  id: number
  action: 'store' | 'search' | 'delete'
  content: string
  memory_id: string | null
  status: 'pending' | 'done' | 'error' | ''
  created_at: string
}

interface StreamResponse {
  items: StreamItem[]
  total: number
}

const { fetchJson } = useApi()

const storeItems = ref<StreamItem[]>([])
const searchItems = ref<StreamItem[]>([])
const storeTotal = ref(0)
const searchTotal = ref(0)
const knownIds = ref(new Set<string>())

const totalCount = computed(() =>
  `MCP ${storeTotal.value} 条 / 搜索 ${searchTotal.value} 条`
)

const storeCountText = computed(() => `${storeItems.value.length} 条`)
const searchCountText = computed(() => `${searchItems.value.length} 条`)

function getActionLabel(action: string): string {
  if (action === 'store') return '存入'
  if (action === 'search') return '搜索'
  return '删除'
}

function formatTime(createdAt: string): string {
  return (createdAt || '').slice(11, 19)
}

function getItemText(item: StreamItem): string {
  return item.content || item.memory_id || ''
}

function isNew(id: number): boolean {
  return !knownIds.value.has(String(id))
}

function markKnown(items: StreamItem[]) {
  items.forEach(item => knownIds.value.add(String(item.id)))
}

function getStatusIcon(status: string): 'pending' | 'done' | 'error' | '' {
  if (status === 'pending') return 'pending'
  if (status === 'done') return 'done'
  if (status === 'error') return 'error'
  return ''
}

async function loadStream() {
  try {
    const [storeRes, searchRes] = await Promise.all([
      fetchJson<StreamResponse>('/stream?action=store&days=3'),
      fetchJson<StreamResponse>('/stream?action=search&days=3'),
    ])

    storeItems.value = storeRes.items || []
    searchItems.value = searchRes.items || []
    storeTotal.value = storeRes.total || 0
    searchTotal.value = searchRes.total || 0

    // After the next tick, mark all current items as known so new items
    // added in subsequent polls will be the only ones animated.
    requestAnimationFrame(() => {
      markKnown(storeItems.value)
      markKnown(searchItems.value)
    })
  } catch (e) {
    console.error('[stream] load failed:', e)
  }
}

// Status poll: find pending items and check if their status has changed.
const statusPoll = usePolling(async () => {
  const allCurrent = [...storeItems.value, ...searchItems.value]
  const hasPending = allCurrent.some(i => i.status === 'pending')
  if (!hasPending) return

  try {
    const [storeRes, searchRes] = await Promise.all([
      fetchJson<StreamResponse>('/stream?action=store&days=3'),
      fetchJson<StreamResponse>('/stream?action=search&days=3'),
    ])

    const allFresh = [
      ...(storeRes.items || []),
      ...(searchRes.items || []),
    ]
    const statusMap = new Map<number, string>()
    allFresh.forEach(i => statusMap.set(i.id, i.status))

    function updateStatus(items: StreamItem[]) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.status === 'pending') {
          const newStatus = statusMap.get(item.id)
          if (newStatus && newStatus !== 'pending') {
            items[i] = { ...item, status: newStatus as StreamItem['status'] }
          }
        }
      }
    }

    storeItems.value = [...storeItems.value]
    searchItems.value = [...searchItems.value]
    updateStatus(storeItems.value)
    updateStatus(searchItems.value)
  } catch {
    // silent
  }
}, 1000)

const streamPoll = usePolling(loadStream, 2000)

onMounted(() => {
  console.log('[SteamView] mounted')
  loadStream()
  streamPoll.start()
  statusPoll.start()
})
</script>

<template>
  <div class="steam-wrap">
    <div class="steam-header">
      <div class="steam-title">记忆流</div>
      <div class="steam-count">{{ totalCount }}</div>
    </div>

    <div class="steam-columns">
      <!-- Left column: MCP store actions -->
      <div class="steam-column">
        <div class="steam-column-header">
          <div class="steam-column-dot store"></div>
          <span>MCP调用</span>
          <span class="steam-column-count">{{ storeCountText }}</span>
        </div>
        <div class="steam-list">
          <template v-if="storeItems.length === 0">
            <div class="steam-empty">暂无写入记录</div>
          </template>
          <div
            v-for="item in storeItems"
            :key="item.id"
            :data-id="item.id"
            class="steam-item"
            :class="{ new: isNew(item.id) }"
          >
            <div class="steam-dot" :class="item.action"></div>
            <div class="steam-body">
              <span class="steam-action-label">{{ getActionLabel(item.action) }}</span>
              <span class="steam-text">{{ getItemText(item) }}</span>
              <!-- status icon -->
              <div v-if="getStatusIcon(item.status) === 'pending'" class="steam-status-icon">
                <div class="steam-spinner"></div>
              </div>
              <div v-else-if="getStatusIcon(item.status) === 'done'" class="steam-status-icon">
                <span class="steam-check">&#10003;</span>
              </div>
              <div v-else-if="getStatusIcon(item.status) === 'error'" class="steam-status-icon">
                <span class="steam-error">&#10007;</span>
              </div>
            </div>
            <div class="steam-time">{{ formatTime(item.created_at) }}</div>
          </div>
        </div>
      </div>

      <!-- Right column: Search actions -->
      <div class="steam-column">
        <div class="steam-column-header">
          <div class="steam-column-dot search"></div>
          <span>查询记忆</span>
          <span class="steam-column-count">{{ searchCountText }}</span>
        </div>
        <div class="steam-list">
          <template v-if="searchItems.length === 0">
            <div class="steam-empty">暂无查询记录</div>
          </template>
          <div
            v-for="item in searchItems"
            :key="item.id"
            :data-id="item.id"
            class="steam-item"
            :class="{ new: isNew(item.id) }"
          >
            <div class="steam-dot" :class="item.action"></div>
            <div class="steam-body">
              <span class="steam-action-label">{{ getActionLabel(item.action) }}</span>
              <span class="steam-text">{{ getItemText(item) }}</span>
              <!-- status icon -->
              <div v-if="getStatusIcon(item.status) === 'pending'" class="steam-status-icon">
                <div class="steam-spinner"></div>
              </div>
              <div v-else-if="getStatusIcon(item.status) === 'done'" class="steam-status-icon">
                <span class="steam-check">&#10003;</span>
              </div>
              <div v-else-if="getStatusIcon(item.status) === 'error'" class="steam-status-icon">
                <span class="steam-error">&#10007;</span>
              </div>
            </div>
            <div class="steam-time">{{ formatTime(item.created_at) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.steam-wrap {
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  gap: 16px;
  box-sizing: border-box;
  height: 100%;
}

.steam-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.steam-title {
  font-size: 16px;
  font-weight: 700;
  color: #e2e8f0;
}

.steam-count {
  font-size: 12px;
  color: #64748b;
}

/* Two-column layout */
.steam-columns {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.steam-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  overflow: hidden;
  height: 100%;
}

.steam-column-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #94a3b8;
  padding-bottom: 8px;
  border-bottom: 1px solid #2d3149;
}

.steam-column-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.steam-column-dot.store {
  background: #22c55e;
  box-shadow: 0 0 6px #22c55e66;
}

.steam-column-dot.search {
  background: #3b82f6;
  box-shadow: 0 0 6px #3b82f666;
}

.steam-column-count {
  margin-left: auto;
  font-size: 11px;
  color: #64748b;
  font-weight: 400;
}

.steam-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  height: 100%;
}

.steam-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: #1a1d27;
  border: 1px solid #2d3149;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 12px;
  color: #94a3b8;
}

.steam-item.new {
  animation: slideIn 0.3s ease-out both;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-12px);
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
    border-width: 0;
    margin-bottom: -6px;
  }
  to {
    opacity: 1;
    transform: translateY(0);
    max-height: 200px;
    padding-top: 10px;
    padding-bottom: 10px;
    border-width: 1px;
    margin-bottom: 6px;
  }
}

.steam-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 4px;
}

.steam-dot.store {
  background: #22c55e;
  box-shadow: 0 0 6px #22c55e66;
}

.steam-dot.search {
  background: #3b82f6;
  box-shadow: 0 0 6px #3b82f666;
}

.steam-dot.delete {
  background: #ef4444;
  box-shadow: 0 0 6px #ef444466;
}

.steam-body {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.steam-action-label {
  font-weight: 600;
  color: #a78bfa;
  margin-right: 6px;
  flex-shrink: 0;
}

.steam-text {
  white-space: pre-wrap;
  word-break: break-word;
  color: #cbd5e1;
  line-height: 1.5;
  flex: 1;
}

.steam-time {
  font-size: 10px;
  color: #475569;
  white-space: nowrap;
  flex-shrink: 0;
  margin-top: 2px;
}

.steam-empty {
  text-align: center;
  color: #475569;
  padding: 40px 0;
  font-size: 13px;
}

/* Status icons: spinner / check / error */
.steam-status-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.steam-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid #475569;
  border-top-color: #a78bfa;
  border-radius: 50%;
  animation: steamSpin 0.8s linear infinite;
}

@keyframes steamSpin {
  to {
    transform: rotate(360deg);
  }
}

.steam-check {
  font-size: 13px;
  font-weight: 700;
  color: #22c55e;
}

.steam-error {
  font-size: 12px;
  font-weight: 700;
  color: #ef4444;
}
</style>

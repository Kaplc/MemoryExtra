<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useStatusStore } from '@/stores/status'
import { useApi } from '@/composables/useApi'
import { useToast } from '@/composables/useToast'
import { usePolling } from '@/composables/usePolling'
import { useEcharts } from '@/composables/useEcharts'

// ── Composables ────────────────────────────────────────────
const { fetchJson, postJson } = useApi()
const statusStore = useStatusStore()
const toast = useToast()

// ── Chart refs ─────────────────────────────────────────────
const cumulativeChartRef = ref<HTMLElement | null>(null)
const addedChartRef = ref<HTMLElement | null>(null)
const cumulativeChart = useEcharts(cumulativeChartRef)
const addedChart = useEcharts(addedChartRef)

// ── Polling instances ──────────────────────────────────────
const modelPolling = usePolling(pollModelStatus, 2000)
const qdrantPolling = usePolling(pollQdrantStatus, 2000)
const sysInfoPolling = usePolling(pollSystemInfo, 1000)

// ── Reactive state ─────────────────────────────────────────

// Model card
const modelBadge = ref<'loading' | 'ok' | 'err'>('loading')
const modelSubText = ref('加载中...')

// Qdrant card
const qdrantBadge = ref<'loading' | 'ok' | 'err'>('loading')

// Flask card
const flaskBadge = ref<'ok' | 'err' | 'restarting' | 'yellow'>('ok')
const flaskRestarting = ref(false)
const flaskRestartSeconds = ref(0)

// System / device info
const sysInfo = ref<any>(null)

// Chart state
const currentChartRange = ref<'today' | 'week' | 'month' | 'all'>('today')
const currentDataView = ref<'cumulative' | 'added'>('cumulative')
const chartData = ref<any[]>([])
const addedChartData = ref<any[]>([])

// Stats
const statTotalValue = ref(0)
const statTotalDisplay = ref(0)
const statIncrementValue = ref(0)
const statIncrementDisplay = ref(0)
const statIncrementLabel = ref('24h新增')
const addedStatValue = ref(0)
const addedStatDisplay = ref(0)
const addedStatLabel = ref('24h新增')

// Animate count intervals
const _animTimers: Record<string, ReturnType<typeof setInterval>> = {}

// ── Helpers ────────────────────────────────────────────────

function _formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

function formatDiskSize(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  if (bytes > 0) return `${Math.round(bytes / 1024)} KB`
  return '-'
}

function animateCount(
  displayRef: { value: number },
  target: number,
  key: string
) {
  if (_animTimers[key]) {
    clearInterval(_animTimers[key])
    delete _animTimers[key]
  }
  const current = displayRef.value
  if (current === target) return
  const diff = target - current
  const step = Math.max(1, Math.ceil(Math.abs(diff) / 10))
  _animTimers[key] = setInterval(() => {
    const now = displayRef.value
    const delta = target > now ? Math.min(step, target - now) : Math.max(-step, target - now)
    if (now === target || (delta > 0 ? now >= target : now <= target)) {
      displayRef.value = target
      clearInterval(_animTimers[key])
      delete _animTimers[key]
    } else {
      displayRef.value = now + delta
    }
  }, 50)
}

// ── Computed: Model card ───────────────────────────────────

const modelSubDisplay = computed(() => {
  if (modelBadge.value === 'ok') {
    return `${statusStore.embeddingModel || 'bge-m3'} ${statusStore.modelSize || ''}`
  }
  return modelSubText.value
})

// ── Computed: Qdrant card ──────────────────────────────────

const qdrantHostPort = computed(() =>
  `${statusStore.qdrantHost}:${statusStore.qdrantPort}`
)
const qdrantCollection = computed(() =>
  `Collection: ${statusStore.qdrantCollection}`
)
const qdrantStorage = computed(() =>
  `存储: ${statusStore.qdrantStoragePath}`
)
const qdrantTopK = computed(() =>
  `Top-K: ${statusStore.qdrantTopK}`
)
const qdrantDim = computed(() =>
  `维度: ${statusStore.embeddingDim}`
)
const qdrantDiskSizeDisplay = computed(() =>
  `磁盘: ${formatDiskSize(statusStore.qdrantDiskSize)}`
)

// ── Computed: Flask card ───────────────────────────────────

const flaskSub1 = computed(() => `端口: ${statusStore.flaskPort ?? '?'}`)
const flaskSub2 = computed(() => `PID: ${statusStore.flaskPid ?? '?'}`)
const flaskSub3 = computed(() => `运行: ${_formatUptime(statusStore.flaskUptime || 0)}`)
const flaskSub4 = computed(() => `热重载: ${statusStore.flaskReload ? 'ON' : 'OFF'}`)

// ── Computed: Device card ──────────────────────────────────

const devicePlatform = computed(() =>
  sysInfo.value ? (sysInfo.value.platform || '').substring(0, 50) : ''
)
const deviceCpu = computed(() =>
  sysInfo.value ? `CPU ${(sysInfo.value.cpu_percent || 0).toFixed(0)}%` : ''
)
const deviceCpuTemp = computed(() =>
  sysInfo.value && sysInfo.value.cpu_temperature != null
    ? `CPU温度 ${sysInfo.value.cpu_temperature}°C` : ''
)
const deviceMemory = computed(() => {
  if (!sysInfo.value) return ''
  const total = sysInfo.value.memory_total / (1024 ** 3)
  const used = sysInfo.value.memory_used / (1024 ** 3)
  return `内存 ${used.toFixed(1)}/${total.toFixed(1)}GB ${sysInfo.value.memory_percent.toFixed(0)}%`
})
const deviceGpuName = computed(() =>
  sysInfo.value?.gpu ? `GPU ${sysInfo.value.gpu.name}` : ''
)
const deviceGpuMem = computed(() => {
  if (!sysInfo.value?.gpu) return ''
  const g = sysInfo.value.gpu
  const total = g.memory_total / (1024 ** 3)
  const used = g.memory_used / (1024 ** 3)
  return `显存 ${used.toFixed(1)}/${total.toFixed(1)}GB ${g.memory_percent}%`
})
const deviceGpuTemp = computed(() =>
  sysInfo.value?.gpu && sysInfo.value.gpu.temperature != null
    ? `GPU温度 ${sysInfo.value.gpu.temperature}°C` : ''
)

// ── Chart stats computed ───────────────────────────────────

const chartStatsClass = computed(() => {
  if (currentDataView.value === 'added') return 'chart-stats single'
  if (currentChartRange.value === 'all') return 'chart-stats single'
  return 'chart-stats'
})

const showIncrementStat = computed(() =>
  currentDataView.value === 'cumulative' && currentChartRange.value !== 'all'
)

// ── Badge CSS class helpers ────────────────────────────────

function badgeClass(state: string): string {
  const map: Record<string, string> = {
    loading: 'sc-badge',
    ok: 'sc-badge green',
    err: 'sc-badge red',
    restarting: 'sc-badge yellow',
    yellow: 'sc-badge yellow',
  }
  return map[state] || 'sc-badge'
}

// ── Polling callbacks ──────────────────────────────────────

async function pollModelStatus() {
  try {
    const st = await fetchJson<any>('/status')
    statusStore.$patch({
      modelLoaded: st.model_loaded ?? false,
      qdrantReady: st.qdrant_ready ?? false,
      device: st.device ?? 'cpu',
      embeddingModel: st.embedding_model ?? '',
      embeddingDim: st.embedding_dim ?? 1024,
      modelSize: st.model_size ?? '',
    })
    if (st.model_loaded) {
      modelBadge.value = 'ok'
    } else {
      modelBadge.value = 'loading'
      modelSubText.value = '加载中...'
    }
    // Also update Qdrant badge from same response
    if (st.qdrant_ready) {
      qdrantBadge.value = 'ok'
    }
    // Stop polling when both ready
    if (st.model_loaded && st.qdrant_ready) {
      modelPolling.stop()
    }
  } catch { /* keep previous state */ }
}

async function pollQdrantStatus() {
  try {
    const st = await fetchJson<any>('/status')
    statusStore.$patch({
      qdrantReady: st.qdrant_ready ?? false,
      qdrantHost: st.qdrant_host ?? 'localhost',
      qdrantPort: st.qdrant_port ?? 6333,
      qdrantCollection: st.qdrant_collection ?? 'memories',
      qdrantStoragePath: st.qdrant_storage_path ?? 'storage',
      qdrantTopK: st.qdrant_top_k ?? 5,
      qdrantDiskSize: st.qdrant_disk_size ?? 0,
      embeddingDim: st.embedding_dim ?? 1024,
    })
    if (st.qdrant_ready) {
      qdrantBadge.value = 'ok'
      qdrantPolling.stop()
    } else {
      qdrantBadge.value = 'loading'
    }
  } catch { /* keep previous state */ }
}

async function pollSystemInfo() {
  try {
    const info = await fetchJson<any>('/system-info')
    sysInfo.value = info
  } catch { /* keep previous state */ }
}

// ── Chart functions ────────────────────────────────────────

function drawCumulativeChart(data: any[], range: string) {
  chartData.value = data

  const dates = data.map((d: any) => {
    if (range === 'today') return d.date
    const day = d.date.slice(-2)
    if (day === '01') return d.date.slice(5, 7) + '月'
    return day
  })

  const storedData = data

  cumulativeChart.setOption({
    grid: { top: 8, right: 52, bottom: 24, left: 8 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: '#2d3149' } },
      axisLabel: { color: '#64748b', fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      position: 'right',
      splitLine: { lineStyle: { color: '#2d314922' } },
      axisLabel: { color: '#64748b', fontSize: 10 },
      axisLine: { show: false },
      axisTick: { show: false },
      min: (value: { min: number }) => Math.floor(value.min / 10) * 10 || 0,
      max: (value: { max: number }) => Math.ceil(value.max / 10) * 10 || 10,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e293b',
      borderColor: '#475569',
      borderWidth: 1,
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      formatter: (params: any) => {
        const rawData = storedData ? storedData[params[0].dataIndex] : null
        const fullDate = rawData ? rawData.date : params[0].axisValue
        return '<div style="font-weight:600;color:#a78bfa;margin-bottom:6px">' + fullDate + '</div>' +
          '<div style="display:flex;justify-content:space-between;gap:12px"><span style="color:#94a3b8">累计</span><span style="font-weight:600;color:#a78bfa">' + params[0].value + '</span></div>'
      }
    },
    series: [
      {
        name: '累计',
        type: 'line',
        data: data.map((d: any) => d.total),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#7c3aed', width: 2 },
        itemStyle: { color: '#7c3aed' },
      },
    ],
  })
}

function drawAddedChart(data: any[], range: string) {
  addedChartData.value = data

  const dates = data.map((d: any) => {
    if (range === 'today') return d.date
    const day = d.date.slice(-2)
    if (day === '01') return d.date.slice(5, 7) + '月'
    return day
  })

  const storedData = data

  addedChart.setOption({
    grid: { top: 8, right: 52, bottom: 24, left: 8 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: '#2d3149' } },
      axisLabel: { color: '#64748b', fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      position: 'right',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#2d314922' } },
      axisLabel: { color: '#64748b', fontSize: 10 },
      axisLine: { show: false },
      axisTick: { show: false },
      min: 0,
      max: (value: { max: number }) => {
        const maxVal = value.max
        if (maxVal <= 5) return 5
        if (maxVal <= 20) return Math.ceil(maxVal / 5) * 5
        if (maxVal <= 100) return Math.ceil(maxVal / 10) * 10
        if (maxVal <= 500) return Math.ceil(maxVal / 50) * 50
        return Math.ceil(maxVal / 100) * 100
      },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e293b',
      borderColor: '#475569',
      borderWidth: 1,
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      formatter: (params: any) => {
        const rawData = storedData ? storedData[params[0].dataIndex] : null
        const fullDate = rawData ? rawData.date : params[0].axisValue
        return '<div style="font-weight:600;color:#86efac;margin-bottom:6px">' + fullDate + '</div>' +
          '<div style="display:flex;justify-content:space-between;gap:12px"><span style="color:#94a3b8">新增</span><span style="font-weight:600;color:#86efac">' + params[0].value + '</span></div>'
      }
    },
    series: [
      {
        name: '新增',
        type: 'line',
        data: data.map((d: any) => d.added || 0),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#22c55e', width: 2 },
        itemStyle: { color: '#22c55e' },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#22c55e33' },
              { offset: 1, color: '#22c55e05' }
            ]
          }
        },
      },
    ],
  })
}

async function fetchAndDrawChart(range: string) {
  console.log('[overview] fetchAndDrawChart start', range)
  try {
    const res = await fetchJson<any>('/chart-data?range=' + range)
    console.log('[overview] chart data received', res.data ? res.data.length + ' points' : 'no data')
    const data = res.data || []

    // Update increment stat
    if (range === 'all') {
      // Hide increment stat for "all" range
    } else {
      let rangeAdded = 0
      data.forEach((d: any) => { rangeAdded += d.added || 0 })
      animateCount(statIncrementDisplay, rangeAdded, 'statIncrement')
      statIncrementValue.value = rangeAdded
      const labels: Record<string, string> = { today: '24h新增', week: '7天新增', month: '30天新增' }
      statIncrementLabel.value = labels[range] || '累计'
    }

    drawCumulativeChart(data, range)
  } catch (e) {
    console.error('[overview] chart error:', e)
  }
}

async function fetchAddedChart() {
  try {
    const res = await fetchJson<any>('/chart-data?range=' + currentChartRange.value)
    const data = res.data || []

    let total = 0
    data.forEach((d: any) => { total += d.added || 0 })
    animateCount(addedStatDisplay, total, 'addedStat')
    addedStatValue.value = total
    const labels: Record<string, string> = {
      today: '24h新增', week: '7天新增', month: '30天新增', all: '总新增'
    }
    addedStatLabel.value = labels[currentChartRange.value] || '新增'

    drawAddedChart(data, currentChartRange.value)
  } catch (e) {
    console.error('[overview] added chart error:', e)
  }
}

async function fetchMemoryCount() {
  console.log('[overview] fetchMemoryCount start')
  try {
    const res = await fetchJson<any>('/memory-count')
    console.log('[overview] memory count:', res.count)
    animateCount(statTotalDisplay, res.count || 0, 'statTotal')
    statTotalValue.value = res.count || 0
  } catch (e) {
    console.error('[overview] memory count error:', e)
  }
}

// ── Chart tab switching ────────────────────────────────────

function setChartRange(range: 'today' | 'week' | 'month' | 'all') {
  if (range === currentChartRange.value) return
  console.log('[overview] chart tab changed, fetching range:', range)
  currentChartRange.value = range
  if (currentDataView.value === 'added') {
    fetchAddedChart()
  } else {
    fetchAndDrawChart(range)
  }
}

function setDataView(view: 'cumulative' | 'added') {
  if (view === currentDataView.value) return
  currentDataView.value = view
  if (view === 'added') {
    fetchAddedChart()
  } else {
    fetchAndDrawChart(currentChartRange.value)
  }
}

// ── Flask restart ──────────────────────────────────────────

let _flaskPollTimer: ReturnType<typeof setInterval> | null = null

function cleanupFlaskPoll() {
  if (_flaskPollTimer) {
    clearInterval(_flaskPollTimer)
    _flaskPollTimer = null
  }
}

async function restartFlask() {
  if (flaskRestarting.value) return

  // Confirmation dialog
  if (!confirm('确认重启 Flask 后端？')) return

  flaskRestarting.value = true
  flaskBadge.value = 'yellow'

  try {
    const data = await postJson<any>('/flask/restart', {})
    if (data.ok) {
      // Poll until Flask recovers
      let waited = 0
      let hasFailed = false

      cleanupFlaskPoll()
      _flaskPollTimer = setInterval(async () => {
        waited += 1000
        try {
          const st = await fetchJson<any>('/status')
          if (!st.flask_pid) return
          if (!hasFailed) return  // old process still running
          // Flask recovered
          cleanupFlaskPoll()
          flaskBadge.value = 'ok'
          flaskRestarting.value = false
          updateAllCardsFromStatus(st)
          // Restart model & qdrant polling
          modelPolling.start()
          qdrantPolling.start()
          // Refresh charts
          cumulativeChart.dispose()
          addedChart.dispose()
          fetchAndDrawChart(currentChartRange.value)
          fetchMemoryCount()
        } catch {
          hasFailed = true
          flaskRestartSeconds.value = Math.floor(waited / 1000)
          flaskBadge.value = 'restarting'
          if (waited > 30000) {
            cleanupFlaskPoll()
            flaskBadge.value = 'err'
            flaskRestarting.value = false
          }
        }
      }, 1000)
    } else {
      flaskRestarting.value = false
      flaskBadge.value = 'err'
      toast.show('重启失败: ' + (data.error || '未知错误'), 'error')
    }
  } catch {
    flaskRestarting.value = false
    flaskBadge.value = 'err'
  }
}

function updateAllCardsFromStatus(st: any) {
  statusStore.$patch({
    modelLoaded: st.model_loaded ?? false,
    qdrantReady: st.qdrant_ready ?? false,
    device: st.device ?? 'cpu',
    flaskPid: st.flask_pid ?? null,
    flaskPort: st.flask_port ?? null,
    flaskUptime: st.flask_uptime ?? 0,
    flaskReload: st.flask_reload ?? false,
    embeddingModel: st.embedding_model ?? '',
    embeddingDim: st.embedding_dim ?? 1024,
    modelSize: st.model_size ?? '',
    qdrantHost: st.qdrant_host ?? 'localhost',
    qdrantPort: st.qdrant_port ?? 6333,
    qdrantCollection: st.qdrant_collection ?? 'memories',
    qdrantStoragePath: st.qdrant_storage_path ?? 'storage',
    qdrantTopK: st.qdrant_top_k ?? 5,
    qdrantDiskSize: st.qdrant_disk_size ?? 0,
  })
  if (st.model_loaded) modelBadge.value = 'ok'
  if (st.qdrant_ready) qdrantBadge.value = 'ok'
}

// ── Flask badge display text ───────────────────────────────

const flaskBadgeText = computed(() => {
  if (flaskBadge.value === 'restarting') return `重启${flaskRestartSeconds.value}s`
  if (flaskBadge.value === 'ok') return 'OK'
  if (flaskBadge.value === 'err') return 'ERR'
  if (flaskBadge.value === 'yellow') return '...'
  return 'OK'
})

const restartBtnText = computed(() =>
  flaskRestarting.value ? '重启中...' : '重启'
)

// ── Legend display ─────────────────────────────────────────

const chartLegendDot = computed(() =>
  currentDataView.value === 'cumulative' ? 'purple' : 'green'
)
const chartLegendLabel = computed(() =>
  currentDataView.value === 'cumulative' ? '累计' : '新增'
)

// ── Lifecycle ──────────────────────────────────────────────

onMounted(async () => {
  console.log('[overview] onPageLoad start')
  console.log('[overview] fetching chart and memory count')
  fetchAndDrawChart(currentChartRange.value)
  fetchMemoryCount()

  // Load initial page data
  console.log('[overview] loading overview page data')
  try {
    const [st, info] = await Promise.all([
      fetchJson<any>('/status'),
      fetchJson<any>('/system-info'),
    ])

    console.log('[overview] settings/status/sysinfo loaded', { cfg_exists: !!st, st_model_loaded: st.model_loaded })

    // Update all cards
    updateAllCardsFromStatus(st)
    if (st.model_loaded && st.qdrant_ready) {
      modelBadge.value = 'ok'
      qdrantBadge.value = 'ok'
    }
    flaskBadge.value = st.flask_pid ? 'ok' : 'err'
    sysInfo.value = info
  } catch (e) {
    console.error('[overview] initial load failed:', e)
  }

  // Start model & Qdrant status polling
  modelPolling.start()
  qdrantPolling.start()

  // Start system info polling
  sysInfoPolling.start()

  console.log('[overview] onPageLoad done')
})

onUnmounted(() => {
  // Clean up animateCount intervals
  Object.keys(_animTimers).forEach(k => {
    clearInterval(_animTimers[k])
    delete _animTimers[k]
  })
  // Clean up Flask restart polling
  cleanupFlaskPoll()
})
</script>

<template>
  <div class="overview-wrap">
    <!-- Status indicators row -->
    <div class="overview-row">
      <!-- Model card -->
      <div class="status-card">
        <div class="sc-label-row">
          <div class="sc-label">模型状态</div>
          <span :class="badgeClass(modelBadge)">
            <span v-if="modelBadge === 'loading'" class="mini-loading sm"></span>
            <template v-else>{{ modelBadge === 'ok' ? 'OK' : '' }}</template>
          </span>
        </div>
        <div class="sc-value"></div>
        <div class="sc-sub">{{ modelSubDisplay }}</div>
      </div>

      <!-- Qdrant card -->
      <div class="status-card">
        <div class="sc-label-row">
          <div class="sc-label">Qdrant 状态</div>
          <span :class="badgeClass(qdrantBadge)">
            <span v-if="qdrantBadge === 'loading'" class="mini-loading sm"></span>
            <template v-else>{{ qdrantBadge === 'ok' ? 'OK' : '' }}</template>
          </span>
        </div>
        <div class="sc-value"></div>
        <div class="sc-sub">{{ qdrantDim }}</div>
        <div class="sc-sub">{{ qdrantHostPort }}</div>
        <div class="sc-sub">{{ qdrantCollection }}</div>
        <div class="sc-sub">{{ qdrantStorage }}</div>
        <div class="sc-sub">{{ qdrantDiskSizeDisplay }}</div>
        <div class="sc-sub">{{ qdrantTopK }}</div>
      </div>

      <!-- Flask card -->
      <div class="status-card">
        <div class="sc-label-row">
          <div class="sc-label">Flask 状态</div>
          <span :class="badgeClass(flaskBadge)">{{ flaskBadgeText }}</span>
        </div>
        <div class="sc-sub">{{ flaskSub1 }}</div>
        <div class="sc-sub">{{ flaskSub2 }}</div>
        <div class="sc-sub">{{ flaskSub3 }}</div>
        <div class="sc-sub">{{ flaskSub4 }}</div>
        <button
          class="flask-restart-btn"
          :disabled="flaskRestarting"
          @click="restartFlask"
        >{{ restartBtnText }}</button>
      </div>

      <!-- Device card -->
      <div class="status-card">
        <div class="sc-label-row">
          <div class="sc-label">设备信息</div>
        </div>
        <div class="sc-sub">{{ devicePlatform }}</div>
        <div class="sc-sub">{{ deviceCpu }}</div>
        <div class="sc-sub">{{ deviceCpuTemp }}</div>
        <div class="sc-sub">{{ deviceMemory }}</div>
        <div class="sc-sub">{{ deviceGpuName }}</div>
        <div class="sc-sub">{{ deviceGpuMem }}</div>
        <div class="sc-sub">{{ deviceGpuTemp }}</div>
      </div>
    </div>

    <!-- Memory chart -->
    <div class="chart-section">
      <div class="chart-header">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="chart-title">记忆数据</div>
          <div class="data-tabs">
            <button
              class="data-tab"
              :class="{ active: currentDataView === 'cumulative' }"
              @click="setDataView('cumulative')"
            >累计曲线</button>
            <button
              class="data-tab"
              :class="{ active: currentDataView === 'added' }"
              @click="setDataView('added')"
            >新增曲线</button>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="chart-legend">
            <span><i class="ldot" :class="chartLegendDot"></i>{{ chartLegendLabel }}</span>
          </div>
          <div class="chart-tabs">
            <button
              class="chart-tab"
              :class="{ active: currentChartRange === 'today' }"
              @click="setChartRange('today')"
            >近24小时</button>
            <button
              class="chart-tab"
              :class="{ active: currentChartRange === 'week' }"
              @click="setChartRange('week')"
            >7天</button>
            <button
              class="chart-tab"
              :class="{ active: currentChartRange === 'month' }"
              @click="setChartRange('month')"
            >30天</button>
            <button
              class="chart-tab"
              :class="{ active: currentChartRange === 'all' }"
              @click="setChartRange('all')"
            >全部</button>
          </div>
        </div>
      </div>

      <!-- Cumulative chart view -->
      <div v-show="currentDataView === 'cumulative'">
        <div ref="cumulativeChartRef" style="width:100%;height:140px;"></div>
        <div :class="chartStatsClass">
          <div class="stat-box">
            <div class="sb-value">{{ statTotalDisplay }}</div>
            <div class="sb-label">记忆总数</div>
          </div>
          <div class="stat-box" v-if="showIncrementStat">
            <div class="sb-value">{{ statIncrementDisplay }}</div>
            <div class="sb-label">{{ statIncrementLabel }}</div>
          </div>
        </div>
      </div>

      <!-- Added chart view -->
      <div v-show="currentDataView === 'added'">
        <div ref="addedChartRef" style="width:100%;height:140px;"></div>
        <div class="chart-stats single">
          <div class="stat-box">
            <div class="sb-value">{{ addedStatDisplay }}</div>
            <div class="sb-label">{{ addedStatLabel }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overview-wrap { padding: 24px; flex: 1; display: flex; flex-direction: column; min-height: 0; overflow-y: auto; gap: 20px; box-sizing: border-box; }
.overview-title { font-size: 18px; font-weight: 700; }
.overview-row { display: flex; gap: 12px; flex-wrap: wrap; }

/* Status card */
.status-card { flex: 1; min-width: 160px; background: #1a1d27; border: 1px solid #2d3149; border-radius: 10px; padding: 16px 18px; display: flex; flex-direction: column; gap: 4px; align-items: flex-start; text-align: left; position: relative; }
.sc-label-row { display: flex; align-items: center; justify-content: space-between; width: 100%; }
.sc-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }
.sc-value { font-size: 15px; font-weight: 700; color: #e2e8f0; }
.sc-badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; margin-left: 6px; }
.sc-badge.green { background: #22c55e22; color: #86efac; }
.sc-badge.red { background: #ef444422; color: #fca5a5; }
.sc-badge.yellow { background: #eab30822; color: #fde047; }
.sc-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
.mini-loading { display: block; width: 24px; height: 24px; border: 2px solid #eab30844; border-top-color: #fde047; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 12px auto; }
.mini-loading.sm { display: inline-block; width: 12px; height: 12px; margin: 0; vertical-align: middle; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Chart section */
.chart-section { background: #1a1d27; border: 1px solid #2d3149; border-radius: 12px; padding: 20px; flex: 1; display: flex; flex-direction: column; gap: 16px; min-height: 0; }
.chart-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.chart-title { font-size: 13px; font-weight: 600; color: #e2e8f0; }
.chart-legend { display: flex; gap: 12px; font-size: 11px; color: #64748b; }
.chart-legend span { display: flex; align-items: center; gap: 4px; }
.ldot { width: 8px; height: 8px; border-radius: 50%; }
.ldot.purple { background: #7c3aed; }
.ldot.green { background: #22c55e; }
.ldot.amber { background: #f59e0b; }
.chart-tabs { display: flex; gap: 2px; background: #12141c; border-radius: 8px; padding: 2px; }
.chart-tab { padding: 3px 10px; border-radius: 6px; font-size: 11px; color: #64748b; cursor: pointer; transition: all .2s; user-select: none; border: none; background: transparent; }
.chart-tab:hover { color: #94a3b8; }
.chart-tab.active { background: #7c3aed33; color: #a78bfa; font-weight: 600; }

/* Stats inside chart section */
.chart-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; padding-top: 16px; border-top: 1px solid #2d3149; }
.chart-stats.single { grid-template-columns: 1fr; }
.stat-box { text-align: center; }
.chart-stats.single .stat-box:first-child { grid-column: 1; }
.sb-value { font-size: 22px; font-weight: 700; color: #a78bfa; }
.sb-label { font-size: 11px; color: #64748b; margin-top: 4px; }

/* Data view tabs */
.data-tabs { display: flex; gap: 2px; background: #12141c; border-radius: 8px; padding: 2px; }
.data-tab { padding: 3px 10px; border-radius: 6px; font-size: 11px; color: #64748b; cursor: pointer; transition: all .2s; user-select: none; border: none; background: transparent; }
.data-tab:hover { color: #94a3b8; }
.data-tab.active { background: #7c3aed33; color: #a78bfa; font-weight: 600; }

/* Flask restart button */
.flask-restart-btn { margin-top: 8px; padding: 4px 14px; border: 1px solid #2d3149; border-radius: 6px; background: transparent; color: #64748b; font-size: 11px; cursor: pointer; transition: all .2s; align-self: flex-start; }
.flask-restart-btn:hover { border-color: #f59e0b; color: #fde047; background: #f59e0b11; }
.flask-restart-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>

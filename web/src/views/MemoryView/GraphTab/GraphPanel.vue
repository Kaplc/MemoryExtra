<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { memoryViewModel } from '../index'
import ForceGraph from 'force-graph'

const vm = memoryViewModel
const containerRef = ref<HTMLDivElement | null>(null)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let graph: any = null
let resizeObserver: ResizeObserver | null = null

const typeColors: Record<string, string> = {
  user: '#5B8FF9',
  self: '#F6BD16',
  rule: '#E86452',
  exp: '#6DC8EC',
  concept: '#945FB9',
}

function buildGraph() {
  if (!containerRef.value) return
  const data = vm.graphTab.graphData.value
  if (!data.nodes.length) return

  if (graph) {
    graph._destructor()
    graph = null
  }

  // 容器尺寸，fallback 保证不为 0
  const width = Math.max(containerRef.value.clientWidth, 300)
  const height = Math.max(containerRef.value.clientHeight, 400)

  const nodes = data.nodes.map(n => ({
    id: n.id,
    label: n.label,
    val: Math.max(1, n.memoryCount),
    color: typeColors[n.type] || '#945FB9',
  }))

  const links = data.edges.map(e => ({
    source: e.source,
    target: e.target,
    speed: 0.001 + Math.random() * 0.003, // 粒子速度随机：0.001 ~ 0.004
  }))

  graph = ForceGraph()(containerRef.value)
    .graphData({ nodes, links })
    .width(width)
    .height(height)
    .backgroundColor('#050816')
    .nodeId('id')
    .nodeLabel('label')
    .nodeVal('val')
    .nodeColor('color')
    .nodeRelSize(5)
    .linkColor(() => 'rgba(120,180,255,0.35)')
    .linkWidth(1)
    .linkDirectionalParticles(2)
    .linkDirectionalParticleWidth(2)
    .linkDirectionalParticleSpeed((link: any) => link.speed)
    .linkDirectionalParticleCanvasObject((x: number, y: number, link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      // 从 __photons 中找出最近的粒子进度，做 source→target 颜色插值
      const photons: any[] = link.__photons || []
      let progress = 0.5
      if (photons.length) {
        // 找距离 (x,y) 最近的粒子
        const src = typeof link.source === 'object' ? link.source : { x: 0, y: 0 }
        const tgt = typeof link.target === 'object' ? link.target : { x: 0, y: 0 }
        let minDist = Infinity
        for (const p of photons) {
          const r = p.__progressRatio ?? 0.5
          const px = src.x + (tgt.x - src.x) * r
          const py = src.y + (tgt.y - src.y) * r
          const d = (px - x) ** 2 + (py - y) ** 2
          if (d < minDist) { minDist = d; progress = r }
        }
      }

      const srcColor = (typeof link.source === 'object' ? link.source.color : null) || '#8ED6FF'
      const tgtColor = (typeof link.target === 'object' ? link.target.color : null) || '#8ED6FF'

      // hex → rgb 解析
      function hexToRgb(hex: string) {
        const h = hex.replace('#', '')
        const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
        return [parseInt(full.slice(0,2),16), parseInt(full.slice(2,4),16), parseInt(full.slice(4,6),16)]
      }
      const [r1,g1,b1] = hexToRgb(srcColor)
      const [r2,g2,b2] = hexToRgb(tgtColor)
      const t = progress
      const r = Math.round(r1 + (r2-r1)*t)
      const g = Math.round(g1 + (g2-g1)*t)
      const b = Math.round(b1 + (b2-b1)*t)

      const radius = Math.max(0, 2 / Math.sqrt(globalScale))
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, 2 * Math.PI)
      ctx.fillStyle = `rgba(${r},${g},${b},0.9)`
      ctx.fill()
    })
    .nodeCanvasObject((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      if (node.x == null || node.y == null) return
      const size = Math.sqrt(Math.max(1, node.val)) * 0.4 + 4
      const color = node.color || '#945FB9'

      // glow halo
      ctx.beginPath()
      ctx.arc(node.x, node.y, size * 2, 0, 2 * Math.PI)
      ctx.fillStyle = color + '22'
      ctx.fill()

      // core circle
      ctx.beginPath()
      ctx.arc(node.x, node.y, size, 0, 2 * Math.PI)
      ctx.fillStyle = color
      ctx.fill()

      // label
      const label = String(node.label || node.id || '')
      const fontSize = Math.min(14, Math.max(8, 12 / globalScale))
      ctx.font = `${fontSize}px Sans-Serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = '#e2e8f0'
      ctx.fillText(label, node.x, node.y + size + 2)
    })
    .nodeCanvasObjectMode(() => 'replace')
    .nodePointerAreaPaint((node: any, color: string, ctx: CanvasRenderingContext2D) => {
      // 点击区域与视觉圆圈完全一致
      if (node.x == null || node.y == null) return
      const size = Math.sqrt(Math.max(1, node.val)) * 0.4 + 4
      ctx.beginPath()
      ctx.arc(node.x, node.y, size, 0, 2 * Math.PI)
      ctx.fillStyle = color
      ctx.fill()
    })
    .enablePanInteraction(false)
    .d3AlphaDecay(0.008)
    .d3VelocityDecay(0.35)
    .warmupTicks(100)
    .cooldownTicks(200)
    .onEngineStop(() => {
      if (graph) graph.zoomToFit(600, 40)
    })

  // 根据两端节点大小动态设置连线距离，节点越大间距越大
  const nodeValMap: Record<string, number> = {}
  nodes.forEach(n => { nodeValMap[n.id] = n.val })
  graph.d3Force('link').distance((link: any) => {
    const srcVal = nodeValMap[typeof link.source === 'object' ? link.source.id : link.source] ?? 1
    const tgtVal = nodeValMap[typeof link.target === 'object' ? link.target.id : link.target] ?? 1
    const srcSize = Math.sqrt(Math.max(1, srcVal)) * 0.4 + 4
    const tgtSize = Math.sqrt(Math.max(1, tgtVal)) * 0.4 + 4
    return (srcSize + tgtSize) * 4 + 30
  })

  // 右键拖拽移动画布，左键仅拖拽节点
  setupRightClickPan()
}

// 右键平移：拦截 canvas 上的鼠标事件，模拟 d3-zoom 的平移行为
function setupRightClickPan() {
  const container = containerRef.value
  if (!container) return

  const canvas = container.querySelector('canvas')
  if (!canvas) return

  // 禁用右键菜单
  canvas.addEventListener('contextmenu', (e) => e.preventDefault())

  let isPanning = false
  let lastX = 0
  let lastY = 0

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 2) return
    isPanning = true
    lastX = e.clientX
    lastY = e.clientY
    canvas.style.cursor = 'grabbing'
    e.preventDefault()
  })

  window.addEventListener('mousemove', (e) => {
    if (!isPanning) return
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    // 通过 graph.centerAt 读取当前中心，计算平移后新中心
    if (graph) {
      const zoom = graph.zoom()
      const center = graph.centerAt()
      graph.centerAt(center.x - dx / zoom, center.y - dy / zoom)
    }
  })

  window.addEventListener('mouseup', (e) => {
    if (e.button !== 2) return
    isPanning = false
    canvas.style.cursor = ''
  })
}

// 数据变化时重建图谱（仅在 graph tab 可见时）
watch(
  () => vm.graphTab.graphData.value,
  (newVal) => {
    if (vm.currentTab.value === 'graph') {
      setTimeout(buildGraph, 150)
    }
  }
)

// 切换到 graph tab 时触发渲染
watch(
  () => vm.currentTab.value,
  (tab) => {
    if (tab === 'graph') {
      setTimeout(() => {
        if (vm.graphTab.graphData.value.nodes.length) {
          buildGraph()
        }
      }, 150)
    }
  }
)

onMounted(() => {
  if (vm.currentTab.value === 'graph') {
    if (!vm.graphTab.graphData.value.nodes.length) {
      vm.graphTab.loadGraph()
    } else {
      setTimeout(buildGraph, 150)
    }
  }

  // 监听容器尺寸变化，实时更新 canvas 大小
  resizeObserver = new ResizeObserver((entries) => {
    if (!graph) return
    const entry = entries[0]
    const { width, height } = entry.contentRect
    if (width > 0 && height > 0) {
      graph.width(width).height(height)
    }
  })
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value)
  }
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (graph) {
    graph._destructor()
    graph = null
  }
})

function handleRefresh() {
  vm.graphTab.loadGraph()
}
</script>

<template>
  <div class="graph-panel">
    <div class="graph-toolbar">
      <span class="graph-info">
        节点: {{ vm.graphTab.graphData.value.nodes.length }} |
        关系: {{ vm.graphTab.graphData.value.edges.length }}
      </span>
      <button class="btn-refresh" @click="handleRefresh" :disabled="vm.graphTab.loading.value">
        {{ vm.graphTab.loading.value ? '加载中...' : '刷新' }}
      </button>
    </div>
    <div v-if="vm.graphTab.loading.value" class="graph-loading">加载图谱数据...</div>
    <div v-else-if="!vm.graphTab.graphData.value.nodes.length" class="graph-empty">暂无图谱数据</div>
    <div ref="containerRef" class="graph-container"></div>
  </div>
</template>

<style scoped>
.graph-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.graph-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #2d3149;
  flex-shrink: 0;
}
.graph-info { font-size: 13px; color: #94a3b8; }
.btn-refresh {
  padding: 4px 14px;
  border: 1px solid #2d3149;
  border-radius: 6px;
  background: #1e2235;
  color: #94a3b8;
  cursor: pointer;
  font-size: 13px;
  transition: all .2s;
}
.btn-refresh:hover { background: #2d3149; color: #e2e8f0; }
.btn-refresh:disabled { opacity: 0.5; cursor: not-allowed; }
.graph-container {
  flex: 1;
  min-height: 400px;
  background: radial-gradient(ellipse at 50% 50%, #0f1b3d 0%, #060816 45%, #020308 100%);
  border-radius: 8px;
  overflow: hidden;
}
.graph-loading, .graph-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  font-size: 14px;
}
</style>

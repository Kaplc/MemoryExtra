<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { memoryViewModel } from '../index'
import * as THREE from 'three'
import ForceGraph3D from '3d-force-graph'

const vm = memoryViewModel
const containerRef = ref<HTMLDivElement | null>(null)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let graph: any = null

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

  const nodes = data.nodes.map(n => ({
    id: n.id,
    label: n.label,
    val: Math.max(1, n.memoryCount),
    color: typeColors[n.type] || '#945FB9',
  }))

  const links = data.edges.map(e => ({
    source: e.source,
    target: e.target,
  }))

  graph = ForceGraph3D({ container: containerRef.value })
    .graphData({ nodes, links })
    .backgroundColor('#050816')
    .nodeId('id')
    .nodeLabel('label')
    .nodeVal('val')
    .nodeColor('color')
    .nodeThreeObject((node: any) => {
      const group = new THREE.Group()
      const size = Math.sqrt(node.val) * 0.4 + 1.5
      const color = new THREE.Color(node.color)

      const coreGeo = new THREE.SphereGeometry(size * 0.5, 32, 32)
      const coreMat = new THREE.MeshBasicMaterial({ color })
      group.add(new THREE.Mesh(coreGeo, coreMat))

      const glowGeo = new THREE.SphereGeometry(size * 1.5, 32, 32)
      const glowMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      group.add(new THREE.Mesh(glowGeo, glowMat))

      return group
    })
    .linkOpacity(0.15)
    .linkWidth(0.5)
    .linkColor('rgba(120,180,255,0.4)')
    .linkDirectionalParticles(2)
    .linkDirectionalParticleWidth(1.2)
    .linkDirectionalParticleColor('#8ED6FF')
    .d3AlphaDecay(0.02)
    .d3VelocityDecay(0.08)
    .cooldownTicks(200)
    .onEngineStop(function() {
      graph.zoomToFit(1000)
    })

  setTimeout(function() {
    if (!graph) return
    const scene = graph.scene()
    const starGeo = new THREE.BufferGeometry()
    const positions: number[] = []
    for (let i = 0; i < 4000; i++) {
      positions.push(
        (Math.random() - 0.5) * 4000,
        (Math.random() - 0.5) * 4000,
        (Math.random() - 0.5) * 4000
      )
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.2,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    })
    scene.add(new THREE.Points(starGeo, starMat))
  }, 100)
}

watch(function() { return vm.graphTab.graphData.value }, function() {
  buildGraph()
})

onMounted(function() {
  if (vm.currentTab.value === 'graph' && !vm.graphTab.graphData.value.nodes.length) {
    vm.graphTab.loadGraph()
  }
})

onUnmounted(function() {
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
  min-height: 0;
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
<script setup lang="ts">
import { useStatusStore } from '@/stores/status'
import { usePolling } from '@/composables/usePolling'

const statusStore = useStatusStore()
console.log('[StatusBar] mounted, starting polling...')
const { start } = usePolling(() => statusStore.fetchStatus(), 3000)

// 立即加载一次，然后启动轮询
statusStore.fetchStatus()
start()
</script>

<template>
  <div class="statusbar">
    <div class="statusbar-item">
      <span>{{ statusStore.modelLoaded ? '模型就绪' : '模型加载中' }}</span>
      <div
        class="statusbar-dot"
        :class="{
          ok: statusStore.modelLoaded,
          loading: !statusStore.modelLoaded,
        }"
      />
    </div>
    <div class="statusbar-item">
      <span>Qdrant</span>
      <div
        class="statusbar-dot"
        :class="{
          ok: statusStore.qdrantReady,
          err: !statusStore.qdrantReady,
        }"
      />
    </div>
    <div class="statusbar-item">
      <span>{{ statusStore.device === 'cuda' ? 'GPU' : 'CPU' }}</span>
    </div>
  </div>
</template>

<style scoped>
.statusbar {
  height: 28px; background: #1a1d27; border-top: 1px solid #2d3149;
  display: flex; align-items: center; justify-content: flex-end;
  gap: 16px; padding: 0 16px; font-size: 11px; color: #64748b;
  flex-shrink: 0;
}
.statusbar-item { display: flex; align-items: center; gap: 5px; }
.statusbar-dot {
  width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
  box-sizing: content-box; transform: none;
}
.statusbar-dot.ok {
  background: #22c55e; box-shadow: 0 0 5px #22c55e;
  animation: dot-pulse-ok 2s ease-in-out infinite;
}
.statusbar-dot.err {
  background: #ef4444; box-shadow: 0 0 4px #ef4444;
}
.statusbar-dot.loading {
  background: #eab308; box-shadow: 0 0 5px #eab308;
  animation: dot-pulse-loading 1s ease-in-out infinite;
}
@keyframes dot-pulse-ok {
  0%, 100% { opacity: 1; box-shadow: 0 0 5px #22c55e; }
  50% { opacity: 0.5; box-shadow: 0 0 2px #22c55e; }
}
@keyframes dot-pulse-loading {
  0%, 100% { opacity: 1; box-shadow: 0 0 5px #eab308; }
  50% { opacity: 0.5; box-shadow: 0 0 2px #eab308; }
}
</style>

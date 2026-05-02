<script setup lang="ts">
import { ref } from 'vue'

const show = ref(false)
console.log('[ConsolePanel] mounted (Vue version)')

function toggle() {
  show.value = !show.value
  console.log(`[ConsolePanel] toggled: show=${show.value}`)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === '`' || e.key === '~') {
    e.preventDefault()
    toggle()
    return
  }
  if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
    e.preventDefault()
    console.log('[Console] Reloading page...')
    window.location.reload()
    return
  }
}

// 全局监听 ~ 键
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', handleKeydown)
}
</script>

<template>
  <div v-if="show" class="console-wrap show">
    <div class="console-header">
      <div class="console-title">控制台</div>
      <div class="console-actions">
        <button class="btn-close" @click="toggle">关闭</button>
      </div>
    </div>
    <div class="console-output">
      <div style="padding: 8px 16px; color: #64748b;">控制台已就绪（Vue 版本）</div>
    </div>
  </div>
  <div v-if="!show" class="console-hint">按 ~ 打开控制台</div>
</template>

<style scoped>
.console-wrap {
  position: fixed; bottom: 28px; left: 80px; right: 0;
  height: 280px; background: #0f1117ee;
  border-top: 1px solid #2d3149;
  display: flex; flex-direction: column;
  z-index: 500; backdrop-filter: blur(8px);
}
.console-wrap.show { display: flex; }
.console-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 16px; border-bottom: 1px solid #2d3149; flex-shrink: 0;
}
.console-title { font-size: 12px; font-weight: 600; color: #a78bfa; }
.console-actions { display: flex; gap: 8px; }
.btn-close {
  padding: 3px 10px; border: none; border-radius: 4px;
  font-size: 11px; cursor: pointer; transition: all .2s;
  background: #ef444422; color: #fca5a5;
}
.btn-close:hover { background: #ef444444; color: #fff; }
.console-output {
  flex: 1; overflow-y: auto; padding: 8px 16px;
  font-family: 'Consolas', monospace; font-size: 12px; line-height: 1.5;
}
.console-hint {
  position: fixed; bottom: 32px; right: 16px;
  font-size: 10px; color: #475569; background: #1a1d2788;
  padding: 3px 8px; border-radius: 4px;
  pointer-events: none; opacity: 0; transition: opacity .3s;
}
.console-hint:hover { opacity: 1; }
</style>

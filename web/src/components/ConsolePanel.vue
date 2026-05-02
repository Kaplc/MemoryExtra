<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { consoleEngine, type ConsoleLine } from '@/composables/ConsoleEngine'
import { consoleVisible } from '@/composables/useConsoleState'

const router = useRouter()
const route = useRoute()

const outputEl = ref<HTMLElement | null>(null)
const inputValue = ref('')
const lines = ref<ConsoleLine[]>([])

function handleSubmit() {
  const input = inputValue.value.trim()
  if (!input) return
  consoleEngine.execute(input)
  inputValue.value = ''
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    handleSubmit()
  }
}

function reload() {
  window.location.reload()
}

onMounted(() => {
  consoleEngine.init({
    currentPage: route.name as string || '',
    router,
    reload,
  })

  consoleEngine.setLogHandler((line: ConsoleLine) => {
    lines.value.push(line)
    if (outputEl.value) {
      outputEl.value.scrollTop = outputEl.value.scrollHeight
    }
  })

  consoleEngine.showWelcome()
})
</script>

<template>
  <div v-if="consoleVisible" class="console-wrap show">
    <div class="console-header">
      <div class="console-title">控制台</div>
      <div class="console-actions">
        <button class="btn-clear" @click="lines = []">清空</button>
        <button class="btn-close" @click="consoleVisible = false">关闭</button>
      </div>
    </div>
    <div class="console-output" ref="outputEl">
      <div
        v-for="line in lines"
        :key="line.id"
        class="console-line"
        :class="'type-' + line.type"
      >{{ line.text }}</div>
    </div>
    <div class="console-input-wrap">
      <span class="console-prompt">&gt;</span>
      <input
        v-model="inputValue"
        class="console-input"
        placeholder="输入命令..."
        @keydown="handleKeydown"
        autofocus
      />
    </div>
  </div>
  <div v-if="!consoleVisible" class="console-hint">按 ~ 打开控制台</div>
</template>

<style scoped>
.console-wrap {
  position: fixed; bottom: 28px; left: 80px; right: 0;
  height: 320px; background: #0f1117ee;
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
.btn-clear {
  padding: 3px 10px; border: none; border-radius: 4px;
  font-size: 11px; cursor: pointer; transition: all .2s;
  background: #3b82f622; color: #60a5fa;
}
.btn-clear:hover { background: #3b82f644; color: #93c5fd; }
.btn-close {
  padding: 3px 10px; border: none; border-radius: 4px;
  font-size: 11px; cursor: pointer; transition: all .2s;
  background: #ef444422; color: #fca5a5;
}
.btn-close:hover { background: #ef444444; color: #fff; }
.console-output {
  flex: 1; overflow-y: auto; padding: 8px 16px;
  font-family: 'Consolas', monospace; font-size: 12px; line-height: 1.6;
}
.console-line { white-space: pre-wrap; word-break: break-all; }
.type-info { color: #94a3b8; }
.type-success { color: #86efac; }
.type-warn { color: #fde047; }
.type-error { color: #fca5a5; }
.console-input-wrap {
  display: flex; align-items: center; padding: 8px 16px;
  border-top: 1px solid #2d3149; flex-shrink: 0;
}
.console-prompt { color: #a78bfa; margin-right: 8px; font-family: 'Consolas', monospace; }
.console-input {
  flex: 1; background: transparent; border: none; outline: none;
  color: #e2e8f0; font-family: 'Consolas', monospace; font-size: 12px;
}
.console-input::placeholder { color: #475569; }
.console-hint {
  position: fixed; bottom: 32px; right: 16px;
  font-size: 10px; color: #475569; background: #1a1d2788;
  padding: 3px 8px; border-radius: 4px;
  pointer-events: none; opacity: 0; transition: opacity .3s;
}
.console-hint:hover { opacity: 1; }
</style>

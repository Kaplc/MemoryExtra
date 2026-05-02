import { onUnmounted } from 'vue'

export function usePolling(callback: () => void, interval: number) {
  let timer: number | null = null

  function start() {
    if (timer !== null) return
    timer = window.setInterval(callback, interval)
  }

  function stop() {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  onUnmounted(stop)

  return { start, stop }
}

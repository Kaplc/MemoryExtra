import { onMounted, onUnmounted, type Ref } from 'vue'
import * as echarts from 'echarts'

export function useEcharts(containerRef: Ref<HTMLElement | null>) {
  let instance: echarts.ECharts | null = null
  let resizeTimer: ReturnType<typeof setTimeout> | null = null

  function init() {
    if (!containerRef.value) return
    instance = echarts.init(containerRef.value)
  }

  function setOption(option: echarts.EChartsOption) {
    if (!instance) init()
    instance?.setOption(option)
  }

  function dispose() {
    if (instance) {
      instance.dispose()
      instance = null
    }
  }

  function handleResize() {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => instance?.resize(), 250)
  }

  onMounted(() => {
    window.addEventListener('resize', handleResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
    dispose()
  })

  return { setOption, dispose, getInstance: () => instance }
}

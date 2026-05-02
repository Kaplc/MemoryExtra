/* 全局控制台状态 */
import { ref } from 'vue'

export const consoleVisible = ref(false)

export function toggleConsole() {
  consoleVisible.value = !consoleVisible.value
}

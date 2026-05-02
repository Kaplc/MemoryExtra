import { ref } from 'vue'

const visible = ref(false)
const message = ref('')
const type = ref<'success' | 'error' | 'info'>('success')
let _timer: ReturnType<typeof setTimeout> | null = null

function show(msg: string, t: 'success' | 'error' | 'info' = 'success') {
  message.value = msg
  type.value = t
  visible.value = true
  if (_timer) clearTimeout(_timer)
  _timer = setTimeout(() => { visible.value = false }, 2800)
}

export function useToast() {
  return { visible, message, type, show }
}

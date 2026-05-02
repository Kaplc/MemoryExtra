import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

console.log('[main] Vue app initializing...')
const app = createApp(App)
app.use(createPinia())
console.log('[main] Pinia installed')
app.use(router)
console.log('[main] Router installed, mounting...')
app.mount('#app')
console.log('[main] Vue app mounted')

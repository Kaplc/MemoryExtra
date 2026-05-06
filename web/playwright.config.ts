import { defineConfig, devices } from '@playwright/test'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(fileURLToPath(import.meta.url), '..', '..')

const portConfigPath = resolve(__dirname, '.port_config')
let port = 19398
try {
  const content = readFileSync(portConfigPath, 'utf-8').trim()
  const firstPort = parseInt(content.split(',')[0], 10)
  if (!isNaN(firstPort)) port = firstPort
} catch {}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  launchOptions: {
    args: ['--proxy-bypass-list=127.0.0.1;localhost', '--proxy-server=direct://'],
  },
  webServer: undefined as any,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
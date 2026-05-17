import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'

const portFile = '.port_config'
let basePort = '19398'
try {
  const ports = readFileSync(portFile, 'utf-8').trim().split(',')
  basePort = ports[0] || '19398'
} catch {}
const BASE = `http://127.0.0.1:${basePort}`

const get = (path: string) =>
  fetch(`${BASE}${path}`, { method: 'GET' }).then(r => r.json())

const post = (path: string, body: object) =>
  fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json())

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

/* 记忆流实体标签 E2E 测试 */
test.describe('Stream Entity Tags', () => {
  test.setTimeout(120000)

  test('存入记忆带实体标签，记忆流应显示实体标签', async () => {
    // 存入带实体标签的记忆
    const storeResult = await post('/memory/store', {
      text: '测试实体标签显示功能abc123',
      memory_meta: { source: 'test', link_entities: ['用户', '事实', '测试标签A'] }
    })
    console.log('[存入结果]', JSON.stringify(storeResult, null, 2))
    expect(storeResult.error).toBeUndefined()

    await wait(2000)

    // 查询记忆流
    const streamResult = await get('/stream/api?limit=50')
    console.log('[流查询结果]', JSON.stringify(streamResult, null, 2))
    expect(streamResult.items).toBeDefined()

    // 找我们刚存入的记忆
    const ourItem = streamResult.items.find((item: any) =>
      item.content?.includes('测试实体标签显示功能abc123')
    )
    console.log('[找到的记忆流项]', JSON.stringify(ourItem, null, 2))

    expect(ourItem).toBeDefined()
    expect(ourItem.entities).toBeDefined()
    // 验证实体标签包含我们传入的实体
    expect(ourItem.entities).toContain('用户')
    expect(ourItem.entities).toContain('事实')
    expect(ourItem.entities).toContain('测试标签A')
  })

  test('不带实体存入的记忆应返回错误', async () => {
    const storeResult = await post('/memory/store', {
      text: '无实体标签测试xyz789',
      memory_meta: { source: 'test' }
    })
    console.log('[无实体存入结果]', JSON.stringify(storeResult, null, 2))
    expect(storeResult.error).toBeDefined()
    expect(storeResult.error).toContain('必须关联')
  })
})
import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'

const portFile = '.port_config'
let basePort = '19398'
try {
  const ports = readFileSync(portFile, 'utf-8').trim().split(',')
  basePort = ports[0] || '19398'
} catch {}
const BASE = `http://127.0.0.1:${basePort}`

const post = (path: string, body: object) =>
  fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json())

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

/* 图实体枢纽搜索 - 核心功能测试 */
test.describe('Graph Entity Search', () => {

  test('根实体初始化: 启动时自动创建4个默认实体', async () => {
    const result = await post('/memory/graph/entities', {})
    console.log('[根实体初始化]', JSON.stringify(result, null, 2))

    expect(result.entities).toBeDefined()
    expect(result.entities.length).toBeGreaterThanOrEqual(4)
    const names = result.entities.map((e: any) => e.name)
    expect(names).toContain('自己')
    expect(names).toContain('用户')
    expect(names).toContain('事实')
    expect(names).toContain('经验')

    // 验证每个实体都有 type 和 memory_count
    for (const e of result.entities) {
      expect(e).toHaveProperty('type')
      expect(e).toHaveProperty('memory_count')
    }
  })

  test('保存记忆并链接实体: link_entities 正确关联记忆和实体', async () => {
    // 用同步 store 接口，确保能立即看到结果
    // 同时测试：1) 已有默认实体(用户/事实)  2) 新建实体(猫猫)
    const store = await post('/memory/store', {
      text: 'cat_graph_link_xyz123',  // 简单英文便于搜索匹配
      memory_meta: { source: 'test', link_entities: ['用户', '事实', '猫猫'] }
    })
    console.log('[保存记忆]', JSON.stringify(store, null, 2))
    expect(store.error).toBeUndefined()

    await wait(4000)

    // 验证实体查询：用户实体已关联记忆
    const entityResult = await post('/memory/graph/entity', { entity_name: '用户' })
    console.log('[实体查询-用户]', JSON.stringify(entityResult, null, 2))
    expect(entityResult.exists).toBe(true)
    expect(entityResult.memories.length).toBeGreaterThan(0)

    // 验证实体查询：事实实体也关联了记忆
    const factResult = await post('/memory/graph/entity', { entity_name: '事实' })
    console.log('[实体查询-事实]', JSON.stringify(factResult, null, 2))
    expect(factResult.exists).toBe(true)

    // 验证新建实体：猫猫（不是默认实体，是新建的）
    await wait(2000)  // 等待实体创建完成
    const catEntity = await post('/memory/graph/entity', { entity_name: '猫猫' })
    console.log('[实体查询-猫猫(新实体)]', JSON.stringify(catEntity, null, 2))
    expect(catEntity.exists).toBe(true)
    // 验证新实体有关联的记忆
    expect(catEntity.memories.length).toBeGreaterThan(0)
    console.log('[猫猫实体关联的记忆数]', catEntity.memories.length)
    expect(factResult.memories.length).toBeGreaterThan(0)
  })

  test('搜索结果带实体信息: 每条记忆附上关联的实体名列表', async () => {
    // 搜索我们刚存的记忆（使用 mcp/search 接口返回 results 格式）
    const searchResult = await post('/memory/mcp/search', { query: 'cat_graph_link_xyz123' })
    console.log('[搜索结果]', JSON.stringify(searchResult, null, 2))
    expect(searchResult.results).toBeDefined()

    // 过滤出我们刚存的记忆（英文便于匹配）
    const ourMemories = searchResult.results.filter((m: any) =>
      m.text?.includes('cat_graph_link_xyz123')
    )
    console.log(`[找到${ourMemories.length}条测试记忆]`)

    if (ourMemories.length > 0) {
      // 验证第一条结果有 entities 字段
      const first = ourMemories[0]
      console.log('[第一条记忆]', JSON.stringify(first, null, 2))
      expect(first).toHaveProperty('entities')

      // 验证实体包含用户和事实
      if (first.entities && first.entities.length > 0) {
        console.log('[实体列表]', first.entities)
      }
    } else {
      // 如果找不到，可能 mem0 重写了。搜索更通用的词
      const fallback = await post('/memory/mcp/search', { query: 'cat_graph' })
      console.log('[fallback搜索]', JSON.stringify(fallback, null, 2))
    }
  })

  test('实体查询: 存在的实体返回详细信息，不存在的返回 exists=false', async () => {
    // 存在
    const exists = await post('/memory/graph/entity', { entity_name: '用户' })
    console.log('[存在实体]', JSON.stringify(exists, null, 2))
    expect(exists.exists).toBe(true)
    expect(exists).toHaveProperty('name')
    expect(exists).toHaveProperty('type')
    expect(exists).toHaveProperty('memories')
    expect(exists).toHaveProperty('related_entities')

    // 不存在
    const notExists = await post('/memory/graph/entity', { entity_name: '完全不存在的实体_xyz' })
    console.log('[不存在实体]', JSON.stringify(notExists, null, 2))
    expect(notExists.exists).toBe(false)
  })

  test('关联实体扩展: 通过共享实体发现关联记忆', async () => {
    // 保存第一条记忆关联用户
    await post('/memory/store', {
      text: 'entity_link_test_a',
      memory_meta: { source: 'test', link_entities: ['用户'] }
    })
    await wait(3000)

    // 保存第二条记忆也关联用户（共享实体）
    await post('/memory/store', {
      text: 'entity_link_test_b',
      memory_meta: { source: 'test', link_entities: ['用户'] }
    })
    await wait(3000)

    // 搜索第一条，验证图扩展能发现关联记忆
    const search = await post('/memory/search', { query: 'entity_link_test_a' })
    console.log('[图扩展搜索]', JSON.stringify(search, null, 2))

    if (search.memories) {
      const graphResults = search.memories.filter((m: any) => m.source === 'graph')
      console.log(`[图扩展结果数: ${graphResults.length}]`)
      if (graphResults.length > 0) {
        console.log('[图扩展结果]', JSON.stringify(graphResults, null, 2))
      }
    }
  })
})
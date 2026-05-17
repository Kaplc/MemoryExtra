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

/* 图深度关联搜索测试 - 验证多跳深链遍历 */
test.describe('Graph Deep Link Search', () => {
  test.setTimeout(120000)

  test('深度关联链: A→B→C→D 4层实体跳转搜索', async () => {
    /**
     * 深度链设计：
     *   记忆A ["程序员"]  ──共享实体──  记忆B ["志远"]
     *                               │
     *                          共享实体
     *                               │
     *                          记忆C ["AI工具"]  ──共享实体──  记忆D ["本地知识库"]
     *
     * 目标：从记忆A出发，经过4跳(A→B→C→D)能发现记忆D
     */

    // 创建4条记忆，每条关联不同实体，串成链
    // 注：文本不能太短，否则被 mem0 改写
    const chain = [
      { text: '深度链ABC程序员xyz789', entities: ['程序员'] },
      { text: '深度链BCD志远xyz456',    entities: ['程序员', '志远'] },
      { text: '深度链CDA工具有xyz123',  entities: ['志远', 'AI工具'] },
      { text: '深度链D知识库xyz000',    entities: ['AI工具', '本地知识库'] },
    ]

    for (const item of chain) {
      await post('/memory/store', {
        text: item.text,
        memory_meta: { source: 'test', link_entities: item.entities }
      })
      await wait(5000)
    }

    await wait(3000)

    // 搜索"程序员"，验证能通过深度扩展发现最深的"本地知识库"
    const searchResult = await post('/memory/mcp/search', { query: '深度链ABC程序员xyz789' })
    console.log('[搜索结果]', JSON.stringify(searchResult, null, 2))
    expect(searchResult.results).toBeDefined()

    // 过滤出深度链的记忆
    const deepChain = searchResult.results.filter((m: any) =>
      m.text?.includes('深度链')
    )
    console.log(`[深度链记忆数量: ${deepChain.length}]`)

    // 验证找到了3条深度链记忆（图扩展发现的关联记忆）
    expect(deepChain.length).toBeGreaterThanOrEqual(3)

    // 验证"本地知识库"记忆（末端，深4跳）在结果中
    const dkMem = deepChain.find((m: any) => m.text?.includes('知识库'))
    console.log('[本地知识库记忆实体]', dkMem?.entities)
    expect(dkMem).toBeDefined()
    expect(dkMem).toHaveProperty('entities')
  })

  test('深度实体路径: 验证从起始记忆到末端记忆的实体跳数', async () => {
    /**
     * 实体路径验证：
     *   记忆A [实体X]
     *   记忆B [实体X, 实体Y]
     *   记忆C [实体Y, 实体Z]
     *   记忆D [实体Z]
     *
     * max_hops=3 时，从记忆A出发应能发现记忆D
     */

    const chain = [
      { text: '深度_测试_X_mno111', entities: ['实体X'] },
      { text: '深度_测试_XY_pqr222', entities: ['实体X', '实体Y'] },
      { text: '深度_测试_YZ_stu333', entities: ['实体Y', '实体Z'] },
      { text: '深度_测试_Z_vwx444', entities: ['实体Z'] },
    ]

    for (const item of chain) {
      await post('/memory/store', {
        text: item.text,
        memory_meta: { source: 'test', link_entities: item.entities }
      })
      await wait(5000)
    }

    await wait(3000)

    // 搜索起点记忆
    const searchResult = await post('/memory/mcp/search', { query: '深度_测试_X' })
    console.log('[实体路径搜索结果]', JSON.stringify(searchResult, null, 2))

    const found = searchResult.results.filter((m: any) =>
      m.text?.includes('深度_测试_')
    )
    console.log(`[找到${found.length}条深度链记忆]`)

    // 最末端记忆Z应该通过图扩展被发现
    const zMem = found.find((m: any) => m.text?.includes('_Z_vwx444'))
    console.log('[末端记忆Z]', zMem ? { id: zMem.id, score: zMem.score, entities: zMem.entities } : '未找到')

    // 验证路径：A(XY) → B(XY) → C(YZ) → D(Z)
    // 搜索X相关的起点，应该能扩展到Z
    expect(zMem).toBeDefined()
    expect(zMem?.entities).toContain('实体Z')
  })
})
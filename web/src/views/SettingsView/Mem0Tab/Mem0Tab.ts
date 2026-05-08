/* Mem0 tab - 记忆库配置
 *
 * 作用：管理 mem0.json 配置文件（记忆库存储路径等）
 * 实现：动态表单生成、目录校验、保存/重置功能
 */

import { reactive, ref } from 'vue'
import { useApi } from '@/composables/useApi'
import { useToast } from '@/composables/useToast'
import type { ConfigField } from '@/stores/config'
import { registerTab } from '../TabRegistry'
import Mem0TabVue from '../Mem0Tab/Mem0Tab.vue'

export interface SectionFormState {
  fields: ConfigField[]
  values: Record<string, string>
  defaults: Record<string, string>
}

export class Mem0Tab {
  readonly form = reactive<SectionFormState>({ fields: [], values: {}, defaults: {} })
  readonly dirChecks = reactive<Record<string, 'ok' | 'err' | ''>>({})

  private _api = useApi()
  private _toast = useToast()

  /* buildForm：根据字段定义构建表单
   * 流程：清空表单 → 遍历 fields → 初始化 values 和 defaults
   */
  buildForm(fields?: ConfigField[]): void {
    this.form.fields = fields ?? []
    this.form.values = {}
    this.form.defaults = {}
    for (const f of this.form.fields) {
      this.form.values[f.key] = String(f.value ?? '')
      this.form.defaults[f.key] = String(f.default ?? '')
    }
  }

  /* collectData：收集表单数据为 API 所需格式
   * 流程：遍历所有字段 → 转换 number 类型 → 处理带下划线的 key 为嵌套对象
   * 示例：mem0_limit → { mem0: { limit: value } }
   */
  collectData(): Record<string, any> {
    const data: Record<string, any> = {}
    for (const f of this.form.fields) {
      const raw = this.form.values[f.key] ?? ''
      const val = f.type === 'number' ? (parseInt(raw) || 0) : raw
      if (f.key.includes('_')) {
        const parts = f.key.split('_', 2)
        if (parts.length === 2) {
          if (!data[parts[0]]) data[parts[0]] = {}
          data[parts[0]][parts[1]] = val
          continue
        }
      }
      data[f.key] = val
    }
    return data
  }

  /* save：保存 mem0 配置
   * 流程：POST /settings/save-aibrain-config { mem0: collectData() }
   * 错误处理：显示错误提示或成功提示
   */
  async save(): Promise<void> {
    if (!this.form.fields.length) return
    try {
      const r = await this._api.postJson<any>('/settings/save-aibrain-config', { mem0: this.collectData() })
      if (r.error) {
        this._toast.show('保存失败: ' + r.error, 'error')
      } else {
        this._toast.show('✅ mem0.json 已保存', 'success')
      }
    } catch (e: any) {
      this._toast.show('保存失败: ' + e, 'error')
    }
  }

  /* reset：恢复字段默认值
   * 流程：遍历字段 → 用 default 值重置 values
   */
  reset(): void {
    for (const f of this.form.fields) {
      this.form.values[f.key] = String(f.default ?? '')
    }
    this._toast.show('已恢复默认', 'info')
  }

  /* browseDir：选择目录
   * 流程：优先调用后端 select-directory 接口 → 用户选择后更新表单值并校验
   * 降级：后端接口不可用时使用原生 file input（webkitdirectory）
   */
  async browseDir(key: string): Promise<void> {
    try {
      const data = await this._api.postJson<{ path?: string }>('/settings/select-directory', {})
      if (data.path) {
        this.form.values[key] = data.path
        this.checkDir(`mem0_${key}`, data.path)
      }
    } catch {
      const native = document.createElement('input')
      native.type = 'file'
      native.webkitdirectory = true
      native.onchange = () => {
        if (native.files && native.files[0]) {
          this.form.values[key] = native.files[0].webkitRelativePath.split('/')[0]
          this.checkDir(`mem0_${key}`, this.form.values[key])
        }
      }
      native.click()
    }
  }

  /* checkDir：校验目录是否存在
   * 流程：POST /settings/check-path → 更新 dirChecks 状态（ok/err）
   */
  async checkDir(inputId: string, path?: string): Promise<void> {
    if (!path) {
      path = (this.form.values[inputId.replace('mem0_', '')] ?? '').trim()
    }
    if (!path) {
      this.dirChecks[inputId] = ''
      return
    }
    try {
      const data = await this._api.postJson<{ exists: boolean }>('/settings/check-path', { path })
      this.dirChecks[inputId] = data.exists ? 'ok' : 'err'
    } catch {
      this.dirChecks[inputId] = ''
    }
  }

  /* loadFromConfig：从配置中加载表单字段定义
   * 流程：读取 aibrain?.mem0?.fields → buildForm 构建表单
   */
  async loadFromConfig(cfg: any, st: any, aibrain: any): Promise<void> {
    const section = aibrain?.mem0
    if (section?.fields) {
      this.buildForm(section.fields)
    }
  }

  /* initDirChecks：初始化所有目录类型字段的校验状态 */
  initDirChecks(): void {
    for (const f of this.form.fields) {
      if (f.type !== 'dir') continue
      const inputId = `mem0_${f.key}`
      const val = this.form.values[f.key] ?? ''
      if (val.trim()) this.checkDir(inputId, val)
    }
  }

  /* onInput：输入时触发目录校验（防抖） */
  onInput(key: string): void {
    this.checkDir(`mem0_${key}`, this.form.values[key])
  }
}

// 主动注册
const _mem0Tab = new Mem0Tab()
registerTab({
  name: 'mem0',
  title: 'mem0.json',
  component: Mem0TabVue,
  tabClass: _mem0Tab,
})

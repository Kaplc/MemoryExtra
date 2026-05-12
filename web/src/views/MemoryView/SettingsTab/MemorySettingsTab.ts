/* 记忆设置 Tab
 *
 * 作用：管理记忆库的运行时参数
 * - infer: 是否调用大模型自动提取实体（关闭后直接存原文，不消耗 LLM）
 */

import { ref, reactive } from 'vue'
import { useApi } from '@/composables/useApi'
import { useToast } from '@/composables/useToast'

export class MemorySettingsTab {
  /** 是否正在加载 */
  readonly loading = ref(false)
  /** 是否正在保存 */
  readonly saving = ref(false)

  /** 设置表单 */
  readonly form = reactive({
    infer: true,
  })

  private _api = useApi()
  private _toast = useToast()

  /* load：从后端加载当前设置 */
  async load(): Promise<void> {
    this.loading.value = true
    try {
      const r = await this._api.fetchJson<{ infer: boolean }>('/memory/settings')
      this.form.infer = r.infer ?? true
    } catch (e) {
      console.error('[MemorySettingsTab] load error', e)
    } finally {
      this.loading.value = false
    }
  }

  /* save：将当前表单值提交给后端 */
  async save(): Promise<void> {
    this.saving.value = true
    try {
      const r = await this._api.postJson<{ infer: boolean; error?: string }>(
        '/memory/settings',
        { infer: this.form.infer }
      )
      if ((r as any).error) {
        this._toast.show('保存失败: ' + (r as any).error, 'error')
      } else {
        this.form.infer = r.infer ?? this.form.infer
        this._toast.show('✅ 记忆设置已保存', 'success')
      }
    } catch (e: any) {
      this._toast.show('保存失败: ' + e, 'error')
    } finally {
      this.saving.value = false
    }
  }
}

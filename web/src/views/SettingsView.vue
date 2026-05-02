<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from 'vue'
import { useConfigStore } from '@/stores/config'
import { useApi } from '@/composables/useApi'
import { useToast } from '@/composables/useToast'
import type { ConfigField } from '@/stores/config'

const configStore = useConfigStore()
const { postJson } = useApi()
const toast = useToast()

// ---------- Tab ----------
const activeTab = ref<'model' | 'mem0' | 'wiki'>('model')

// ---------- Model tab state ----------
const modelDesc = ref('')
const gpuInfoHtml = ref('检测中...')
const gpuInfoClass = ref<'ok' | 'warn' | 'err'>('ok')
const savingModel = ref(false)

// device: local pending value, synced from configStore after load
const pendingDevice = ref<string>('cpu')

// ---------- mem0 / wiki dynamic form state ----------
interface SectionFormState {
  fields: ConfigField[]
  values: Record<string, string>
  defaults: Record<string, string>
}

const mem0Form = reactive<SectionFormState>({ fields: [], values: {}, defaults: {} })
const wikiForm = reactive<SectionFormState>({ fields: [], values: {}, defaults: {} })

// ---------- directory existence checks ----------
const dirChecks = reactive<Record<string, 'ok' | 'err' | ''>>({})

// ---------- Lifecycle ----------
onMounted(async () => {
  console.log('[SettingsView] mounted')
  await loadAll()
})

async function loadAll() {
  try {
    const result = await configStore.loadConfig()
    if (!result) return
    const { cfg, st, aibrain } = result

    // device
    const device = cfg.device ?? 'cpu'
    pendingDevice.value = device

    // model description
    const modelName = st.embedding_model || 'BAAI/bge-m3'
    const dim = st.embedding_dim || 1024
    modelDesc.value = `${modelName} · 向量维度 ${dim}`

    // GPU info
    if (st.cuda_available) {
      gpuInfoHtml.value = `✅ 检测到 GPU：<strong>${st.gpu_name}</strong>`
      gpuInfoClass.value = 'ok'
    } else if (st.gpu_hardware) {
      gpuInfoHtml.value =
        `⚠️ 检测到 NVIDIA GPU，但安装的是 CPU 版 PyTorch。<br>` +
        `<small>运行以下命令安装 GPU 版：</small><br>` +
        `<code>pip uninstall torch -y && pip install torch --index-url https://download.pytorch.org/whl/cu124</code>`
      gpuInfoClass.value = 'warn'
    } else {
      gpuInfoHtml.value = '未检测到 NVIDIA GPU，GPU 选项不可用'
      gpuInfoClass.value = 'err'
    }

    // dynamic forms
    buildSectionForm(mem0Form, aibrain?.mem0?.fields)
    buildSectionForm(wikiForm, aibrain?.wiki?.fields)

    // initial directory checks
    await nextTick()
    initAllDirChecks()
  } catch (e) {
    console.error('[SettingsView] loadAll error:', e)
  }
}

function buildSectionForm(form: SectionFormState, fields?: ConfigField[]) {
  form.fields = fields ?? []
  form.values = {}
  form.defaults = {}
  for (const f of form.fields) {
    form.values[f.key] = String(f.value ?? '')
    form.defaults[f.key] = String(f.default ?? '')
  }
}

// ---------- Tab switching ----------
function switchTab(tab: 'model' | 'mem0' | 'wiki') {
  activeTab.value = tab
}

// ---------- Model: save / reset ----------
async function applySettings() {
  if (pendingDevice.value === configStore.savedDevice) {
    toast.show('设置未变更', 'info')
    return
  }
  savingModel.value = true
  try {
    await postJson('/reload-model', { device: pendingDevice.value })
    configStore.savedDevice = pendingDevice.value as any
    configStore.device = pendingDevice.value as any
    toast.show(`✅ 已保存并重载模型（${pendingDevice.value}）`, 'success')
  } catch (e: any) {
    toast.show('保存失败: ' + e, 'error')
  }
  savingModel.value = false
}

function resetSettings() {
  pendingDevice.value = configStore.savedDevice
  toast.show('已重置', 'info')
}

// ---------- mem0 / wiki: save ----------
function collectSectionData(form: SectionFormState, nested = false): Record<string, any> {
  const data: Record<string, any> = {}
  for (const f of form.fields) {
    const raw = form.values[f.key] ?? ''
    const val = f.type === 'number' ? (parseInt(raw) || 0) : raw

    if (nested && f.key.includes('_')) {
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

async function saveMem0Config() {
  if (!mem0Form.fields.length) return
  try {
    const r = await postJson<any>('/save-aibrain-config', { mem0: collectSectionData(mem0Form, true) })
    if (r.error) {
      toast.show('保存失败: ' + r.error, 'error')
    } else {
      toast.show('✅ mem0.json 已保存', 'success')
    }
  } catch (e: any) {
    toast.show('保存失败: ' + e, 'error')
  }
}

async function saveWikiConfig() {
  if (!wikiForm.fields.length) return
  try {
    const r = await postJson<any>('/save-aibrain-config', { wiki: collectSectionData(wikiForm, false) })
    if (r.error) {
      toast.show('保存失败: ' + r.error, 'error')
    } else {
      toast.show('✅ wiki.json 已保存', 'success')
    }
  } catch (e: any) {
    toast.show('保存失败: ' + e, 'error')
  }
}

// ---------- mem0 / wiki: reset ----------
function resetMem0Config() {
  for (const f of mem0Form.fields) {
    mem0Form.values[f.key] = String(f.default ?? '')
  }
  toast.show('已恢复默认', 'info')
}

function resetWikiConfig() {
  for (const f of wikiForm.fields) {
    wikiForm.values[f.key] = String(f.default ?? '')
  }
  toast.show('已恢复默认', 'info')
}

// ---------- Directory browse ----------
async function browseDir(section: 'mem0' | 'wiki', key: string) {
  const inputId = `${section}_${key}`
  try {
    const data = await postJson<{ path?: string }>('/select-directory', {})
    if (data.path) {
      const form = section === 'mem0' ? mem0Form : wikiForm
      form.values[key] = data.path
      checkDir(inputId, data.path)
    }
  } catch {
    // fallback: native file picker
    const native = document.createElement('input')
    native.type = 'file'
    native.webkitdirectory = true
    native.onchange = () => {
      if (native.files && native.files[0]) {
        const basePath = native.files[0].webkitRelativePath.split('/')[0]
        const form = section === 'mem0' ? mem0Form : wikiForm
        form.values[key] = basePath
        checkDir(inputId, basePath)
      }
    }
    native.click()
  }
}

// ---------- Directory existence check ----------
async function checkDir(inputId: string, path?: string) {
  if (!path) {
    const [section, key] = inputId.split('_')
    const form = section === 'mem0' ? mem0Form : wikiForm
    path = (form.values[key] ?? '').trim()
  }
  if (!path) {
    dirChecks[inputId] = ''
    return
  }
  try {
    const data = await postJson<{ exists: boolean }>('/check-path', { path })
    dirChecks[inputId] = data.exists ? 'ok' : 'err'
  } catch {
    dirChecks[inputId] = ''
  }
}

function initAllDirChecks() {
  const allFields: Array<{ section: string; field: ConfigField }> = [
    ...mem0Form.fields.map(f => ({ section: 'mem0', field: f })),
    ...wikiForm.fields.map(f => ({ section: 'wiki', field: f })),
  ]
  for (const { section, field } of allFields) {
    if (field.type !== 'dir') continue
    const inputId = `${section}_${field.key}`
    const val = (section === 'mem0' ? mem0Form : wikiForm).values[field.key] ?? ''
    if (val.trim()) {
      checkDir(inputId, val)
    }
  }
}

function onDirInput(section: 'mem0' | 'wiki', key: string) {
  const inputId = `${section}_${key}`
  const form = section === 'mem0' ? mem0Form : wikiForm
  checkDir(inputId, form.values[key])
}

// ---------- field type helpers ----------
function inputType(type: string): string {
  if (type === 'password') return 'password'
  if (type === 'number') return 'number'
  return 'text'
}
</script>

<template>
  <div class="settings-wrap">
    <div class="settings-header">
      <div class="settings-title">设置</div>
    </div>

    <!-- Tab selection -->
    <div class="config-tabs">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'model' }"
        @click="switchTab('model')"
      >模型</button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'mem0' }"
        @click="switchTab('mem0')"
      >mem0.json</button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'wiki' }"
        @click="switchTab('wiki')"
      >wiki.json</button>
    </div>

    <!-- ====== Model Tab ====== -->
    <div v-show="activeTab === 'model'" class="tab-content">
      <div class="set-row">
        <div class="set-row-label">
          <div class="set-label">模型</div>
          <div class="set-desc">{{ modelDesc }}</div>
        </div>
        <select class="model-select" disabled>
          <option value="BAAI/bge-m3">BAAI/bge-m3</option>
        </select>
      </div>

      <div class="set-row">
        <div class="set-row-label">
          <div class="set-label">推理设备</div>
          <div class="set-desc">选择模型推理使用的硬件</div>
        </div>
        <select class="device-select" v-model="pendingDevice">
          <option value="auto">自动</option>
          <option value="gpu">GPU</option>
          <option value="cpu">CPU</option>
        </select>
      </div>

      <div class="gpu-info" :class="gpuInfoClass" v-html="gpuInfoHtml"></div>

      <div class="header-actions">
        <button class="btn btn-secondary" @click="resetSettings">重置</button>
        <button class="btn btn-primary" :disabled="savingModel" @click="applySettings">
          {{ savingModel ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>

    <!-- ====== mem0.json Tab ====== -->
    <div v-show="activeTab === 'mem0'" class="tab-content">
      <div class="config-form">
        <div v-if="!mem0Form.fields.length" class="loading">加载中...</div>
        <template v-for="f in mem0Form.fields" :key="f.key">
          <div v-if="f.type === 'dir'" class="form-row">
            <label>{{ f.label }}</label>
            <div class="dir-input-wrap">
              <input
                type="text"
                :value="mem0Form.values[f.key]"
                @input="mem0Form.values[f.key] = ($event.target as HTMLInputElement).value"
                @change="onDirInput('mem0', f.key)"
                @blur="onDirInput('mem0', f.key)"
                :placeholder="String(f.default ?? '')"
              />
              <button type="button" class="dir-browse-btn" @click="browseDir('mem0', f.key)">&#128193;</button>
              <span
                class="dir-status"
                :class="dirChecks['mem0_' + f.key] || ''"
              >{{ dirChecks['mem0_' + f.key] === 'ok' ? '✓' : dirChecks['mem0_' + f.key] === 'err' ? '✗ 不存在' : '' }}</span>
            </div>
          </div>
          <div v-else class="form-row">
            <label>{{ f.label }}</label>
            <input
              :type="inputType(f.type)"
              :value="mem0Form.values[f.key]"
              @input="mem0Form.values[f.key] = ($event.target as HTMLInputElement).value"
              :placeholder="String(f.default ?? '')"
            />
          </div>
        </template>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="resetMem0Config">恢复默认</button>
        <button class="btn btn-primary" @click="saveMem0Config">保存</button>
      </div>
    </div>

    <!-- ====== wiki.json Tab ====== -->
    <div v-show="activeTab === 'wiki'" class="tab-content">
      <div class="config-form">
        <div v-if="!wikiForm.fields.length" class="loading">加载中...</div>
        <template v-for="f in wikiForm.fields" :key="f.key">
          <div v-if="f.type === 'dir'" class="form-row">
            <label>{{ f.label }}</label>
            <div class="dir-input-wrap">
              <input
                type="text"
                :value="wikiForm.values[f.key]"
                @input="wikiForm.values[f.key] = ($event.target as HTMLInputElement).value"
                @change="onDirInput('wiki', f.key)"
                @blur="onDirInput('wiki', f.key)"
                :placeholder="String(f.default ?? '')"
              />
              <button type="button" class="dir-browse-btn" @click="browseDir('wiki', f.key)">&#128193;</button>
              <span
                class="dir-status"
                :class="dirChecks['wiki_' + f.key] || ''"
              >{{ dirChecks['wiki_' + f.key] === 'ok' ? '✓' : dirChecks['wiki_' + f.key] === 'err' ? '✗ 不存在' : '' }}</span>
            </div>
          </div>
          <div v-else class="form-row">
            <label>{{ f.label }}</label>
            <input
              :type="inputType(f.type)"
              :value="wikiForm.values[f.key]"
              @input="wikiForm.values[f.key] = ($event.target as HTMLInputElement).value"
              :placeholder="String(f.default ?? '')"
            />
          </div>
        </template>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="resetWikiConfig">恢复默认</button>
        <button class="btn btn-primary" @click="saveWikiConfig">保存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-wrap { padding: 24px; display: flex; flex-direction: column; gap: 16px; box-sizing: border-box; flex: 1; }
.settings-header { display: flex; align-items: center; justify-content: space-between; }
.settings-title { font-size: 18px; font-weight: 700; }
.header-actions { display: flex; gap: 8px; }
.set-row { display: flex; align-items: center; gap: 16px; background: #1a1d27; border: 1px solid #2d3149; border-radius: 10px; padding: 14px 16px; }
.set-row-label { flex: 1; min-width: 0; }
.set-label { font-size: 14px; font-weight: 600; color: #e2e8f0; }
.set-desc { font-size: 11px; color: #64748b; margin-top: 2px; }
.gpu-info { background: #0f1117; border: 1px solid #2d3149; border-radius: 8px; padding: 10px 14px; font-size: 12px; color: #64748b; }
.gpu-info.ok { color: #86efac; border-color: #22c55e44; }
.gpu-info.warn { color: #fde68a; border-color: #f59e0b44; }
.gpu-info.err { color: #fca5a5; border-color: #ef444444; }
.gpu-info :deep(code) { background: #1e293b; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 11px; white-space: nowrap; }
.btn { padding: 8px 16px; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity .2s; }
.btn:active { transform: scale(.98); }
.btn-primary { background: #7c3aed; color: #fff; }
.btn-primary:hover { opacity: .85; }
.btn-primary:disabled { opacity: .4; cursor: not-allowed; }
.btn-secondary { background: #1e293b; color: #94a3b8; border: 1px solid #2d3149; }
.btn-secondary:hover { border-color: #475569; }
.model-select, .device-select {
  background: #0f1117;
  border: 1px solid #2d3149;
  border-radius: 8px;
  color: #e2e8f0;
  padding: 8px 12px;
  font-size: 13px;
  font-family: inherit;
  outline: none;
  cursor: pointer;
  min-width: 140px;
}
.model-select:focus, .device-select:focus { border-color: #7c3aed; }
.config-tabs { display: flex; gap: 8px; background: #1a1d27; border: 1px solid #2d3149; border-radius: 10px; padding: 8px; }
.tab-btn { flex: 1; padding: 8px 16px; background: transparent; border: none; border-radius: 6px; color: #94a3b8; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .2s; }
.tab-btn:hover { color: #e2e8f0; background: #2d3149; }
.tab-btn.active { color: #fff; background: #7c3aed; }
.tab-content { background: #1a1d27; border: 1px solid #2d3149; border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.config-form { display: flex; flex-direction: column; gap: 10px; }
.form-row { display: flex; align-items: center; gap: 12px; }
.form-row label { font-size: 12px; color: #94a3b8; min-width: 120px; }
.form-row input {
  flex: 1;
  background: #0f1117;
  border: 1px solid #2d3149;
  border-radius: 6px;
  color: #e2e8f0;
  padding: 6px 10px;
  font-size: 13px;
  font-family: inherit;
  outline: none;
}
.form-row input:focus { border-color: #7c3aed; }
.loading { font-size: 12px; color: #64748b; text-align: center; padding: 20px; }
.dir-input-wrap { display: flex; align-items: center; flex: 1; gap: 8px; }
.dir-input-wrap input { flex: 1; }
.dir-browse-btn { padding: 6px 10px; background: #2d3149; border: 1px solid #2d3149; border-radius: 6px; cursor: pointer; font-size: 14px; color: #e2e8f0; }
.dir-browse-btn:hover { background: #7c3aed; border-color: #7c3aed; }
.dir-status { font-size: 12px; min-width: 60px; }
.dir-status.ok { color: #86efac; }
.dir-status.err { color: #fca5a5; }
</style>

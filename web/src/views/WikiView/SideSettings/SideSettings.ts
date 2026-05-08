/* 侧边栏设置区 - Composable
 *
 * 作用：封装 WikiViewModel 的设置表单相关功能
 */

import { wikiViewModel } from '../WikiViewModel'

export function useSideSettings() {
  return {
    formWikiDir: wikiViewModel.formWikiDir,
    formLightragDir: wikiViewModel.formLightragDir,
    formLanguage: wikiViewModel.formLanguage,
    formChunkSize: wikiViewModel.formChunkSize,
    formTimeout: wikiViewModel.formTimeout,
    saving: wikiViewModel.saving,
    saveSettings: () => wikiViewModel.saveSettings(),
  }
}

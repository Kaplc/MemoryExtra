/* 侧边栏操作区 - Composable
 *
 * 作用：封装 WikiViewModel 的索引重建相关功能（进度显示、操作按钮）
 */

import { wikiViewModel } from '../WikiViewModel'

export function useSideOps() {
  return {
    showProgress: wikiViewModel.showProgress,
    rebuildIndex: () => wikiViewModel.rebuildIndex(),
    progressLabel: wikiViewModel.progressLabel,
    progressPct: wikiViewModel.progressPct,
    logLines: wikiViewModel.logLines,
    logWrapEl: wikiViewModel.logWrapEl,
    indexResultMsg: wikiViewModel.indexResultMsg,
  }
}

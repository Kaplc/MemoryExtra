/* 侧边栏统计区 - Composable
 *
 * 作用：封装 WikiViewModel 的统计信息（文件数、总大小、索引状态）
 */

import { wikiViewModel } from '../WikiViewModel'

export function useSideStats() {
  return {
    fileCount: () => wikiViewModel.rawFiles.value.length || '-',
    totalSize: () => wikiViewModel.rawFiles.value.length
      ? wikiViewModel.formatSize(wikiViewModel.totalSize)
      : '-',
    indexStatus: wikiViewModel.indexStatusText,
  }
}

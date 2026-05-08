/* 文件列表 - Composable
 *
 * 作用：封装 WikiViewModel 的文件列表相关功能，供 Vue 组件使用
 * 实现：暴露 loading、loadError、sortedFiles、排序方法、格式化方法等
 */

import { wikiViewModel } from '../WikiViewModel'

export function useFileList() {
  return {
    loading: wikiViewModel.loading,
    loadError: wikiViewModel.loadError,
    sortedFiles: () => wikiViewModel.sortedFiles,
    doSort: (key: 'filename' | 'sizeBytes' | 'modified') => wikiViewModel.doSort(key),
    sortArrow: (key: 'filename' | 'sizeBytes' | 'modified') => wikiViewModel.sortArrow(key),
    copyPath: (path: string) => wikiViewModel.copyPath(path),
    formatSize: (bytes: number) => wikiViewModel.formatSize(bytes),
    formatDate: (ts: number) => wikiViewModel.formatDate(ts),
  }
}

/* Wiki 文件项 - 数据模型
 *
 * 作用：封装 API 返回的文件数据，提供文件属性和状态管理
 */

export interface ApiWikiFile {
  filename: string
  abs_path: string
  rel_path?: string
  size_bytes: number
  modified: number
  preview: string
  index_status: 'synced' | 'out_of_sync' | 'not_indexed'
}

export class WikiFileItem {
  readonly filename: string
  readonly abs_path: string
  readonly rel_path: string
  readonly size_bytes: number
  readonly modified: number
  readonly preview: string
  index_status: 'synced' | 'out_of_sync' | 'not_indexed'
  /** 是否为当前正在索引的文件 */
  isCurrent = false

  constructor(file: ApiWikiFile) {
    this.filename = file.filename
    this.abs_path = file.abs_path
    this.rel_path = file.rel_path || this._guessRelPath(file.abs_path, file.filename)
    this.size_bytes = file.size_bytes
    this.modified = file.modified
    this.preview = file.preview
    this.index_status = file.index_status
  }

  /* _guessRelPath：从绝对路径猜测相对路径
   * 流程：在 absPath 中找到 filename 最后一次出现的位置，返回其后半部分
   */
  private _guessRelPath(absPath: string, filename: string): string {
    const idx = absPath.lastIndexOf(filename)
    return idx > 0 ? absPath.slice(idx) : filename
  }

  /* markSynced：标记为已同步状态
   * 流程：index_status='synced'，isCurrent=false
   */
  markSynced(): void {
    this.index_status = 'synced'
    this.isCurrent = false
  }

  /* markCurrent：标记为当前正在处理的文件 */
  markCurrent(): void {
    this.isCurrent = true
  }
}

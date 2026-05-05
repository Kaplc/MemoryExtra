"""Wiki 文件状态管理对象"""
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional


@dataclass
class WikiFile:
    """单个 Wiki 文件的状态对象"""
    filename: str
    abs_path: str
    size_bytes: int
    modified: float  # Unix timestamp
    preview: str = ""
    index_status: str = "not_indexed"  # synced | out_of_sync | not_indexed
    md5: Optional[str] = None
    indexed_at: Optional[str] = None
    is_current: bool = False

    @property
    def rel_path(self) -> str:
        """从绝对路径提取相对路径"""
        import os
        idx = self.abs_path.rfind(self.filename)
        return self.abs_path[idx:] if idx > 0 else self.filename

    @property
    def modified_str(self) -> str:
        """格式化修改时间"""
        dt = datetime.fromtimestamp(self.modified)
        return dt.strftime("%Y-%m-%d %H:%M")

    def mark_synced(self, md5: str, indexed_at: Optional[str] = None):
        """标记为已同步"""
        self.index_status = "synced"
        self.md5 = md5
        self.indexed_at = indexed_at or datetime.now(timezone.utc).isoformat()
        self.is_current = False

    def mark_out_of_sync(self):
        """标记为需重建"""
        self.index_status = "out_of_sync"
        self.is_current = False

    def mark_current(self):
        """标记为正在处理"""
        self.is_current = True

    def to_dict(self) -> dict:
        """转为字典（API 返回格式）"""
        return {
            "filename": self.filename,
            "abs_path": self.abs_path,
            "size_bytes": self.size_bytes,
            "modified": self.modified,
            "preview": self.preview,
            "index_status": self.index_status,
        }


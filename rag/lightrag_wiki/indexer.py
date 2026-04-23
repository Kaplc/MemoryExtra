"""
Wiki 索引管理 - MD 文件扫描、MD5 变化检测、增量索引
"""
import os
import json
import hashlib
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def _compute_file_md5(file_path: str) -> str:
    """计算文件的 MD5 哈希值"""
    h = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def _load_index_meta(meta_path: str) -> dict:
    """加载索引元数据"""
    if os.path.exists(meta_path):
        with open(meta_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"files": {}}


def _save_index_meta(meta_path: str, meta: dict):
    """保存索引元数据"""
    os.makedirs(os.path.dirname(meta_path), exist_ok=True)
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)


def scan_wiki_files(wiki_dir: str) -> list[str]:
    """扫描 wiki 目录下所有 .md 文件

    Args:
        wiki_dir: wiki 目录的绝对路径

    Returns:
        .md 文件的绝对路径列表
    """
    if not os.path.isdir(wiki_dir):
        logger.warning(f"Wiki 目录不存在: {wiki_dir}")
        return []

    md_files = []
    for root, _dirs, files in os.walk(wiki_dir):
        for f in sorted(files):
            if f.lower().endswith(".md"):
                md_files.append(os.path.join(root, f))
    return md_files


def sync_index() -> dict:
    """增量同步索引：检测 wiki 目录变化并更新 LightRAG 索引

    Returns:
        {added: [...], updated: [...], deleted: [...], unchanged: int, errors: [...]}
    """
    from .config import get_wiki_dir, get_index_meta_path
    from .rag_engine import insert_document

    wiki_dir = get_wiki_dir()
    meta_path = get_index_meta_path()

    # 确保 wiki 目录存在
    os.makedirs(wiki_dir, exist_ok=True)

    meta = _load_index_meta(meta_path)
    current_files = scan_wiki_files(wiki_dir)

    # 用相对路径作为 key（相对于 wiki_dir）
    current_map = {}
    for abs_path in current_files:
        rel = os.path.relpath(abs_path, wiki_dir)
        current_map[rel] = abs_path

    indexed_files = meta.get("files", {})
    result = {"added": [], "updated": [], "deleted": [], "unchanged": 0, "errors": []}

    # 检测新增和修改
    for rel_path, abs_path in current_map.items():
        md5 = _compute_file_md5(abs_path)
        old_entry = indexed_files.get(rel_path)

        if old_entry is None:
            # 新文件
            try:
                _index_file(abs_path, rel_path)
                indexed_files[rel_path] = {
                    "md5": md5,
                    "indexed_at": datetime.now(timezone.utc).isoformat(),
                }
                result["added"].append(rel_path)
                logger.info(f"索引新文件: {rel_path}")
            except Exception as e:
                result["errors"].append(f"{rel_path}: {e}")
                logger.error(f"索引失败 {rel_path}: {e}")

        elif old_entry.get("md5") != md5:
            # 文件已修改 — 重新索引
            try:
                _index_file(abs_path, rel_path)
                indexed_files[rel_path] = {
                    "md5": md5,
                    "indexed_at": datetime.now(timezone.utc).isoformat(),
                }
                result["updated"].append(rel_path)
                logger.info(f"重新索引修改文件: {rel_path}")
            except Exception as e:
                result["errors"].append(f"{rel_path}: {e}")
                logger.error(f"重新索引失败 {rel_path}: {e}")
        else:
            result["unchanged"] += 1

    # 检测已删除的文件
    for rel_path in list(indexed_files.keys()):
        if rel_path not in current_map:
            del indexed_files[rel_path]
            result["deleted"].append(rel_path)
            logger.info(f"文件已删除，移除索引: {rel_path}")

    # 保存元数据
    meta["files"] = indexed_files
    _save_index_meta(meta_path, meta)

    total = len(result["added"]) + len(result["updated"]) + len(result["deleted"])
    logger.info(
        f"索引同步完成: 新增 {len(result['added'])}, "
        f"更新 {len(result['updated'])}, 删除 {len(result['deleted'])}, "
        f"未变 {result['unchanged']}"
    )
    return result


def index_single_file(filename: str) -> str:
    """索引单个文件（写入后自动调用）

    Args:
        filename: 相对于 wiki_dir 的文件名

    Returns:
        索引结果描述
    """
    from .config import get_wiki_dir, get_index_meta_path

    wiki_dir = get_wiki_dir()
    abs_path = os.path.join(wiki_dir, filename)

    if not os.path.exists(abs_path):
        return f"文件不存在: {filename}"

    meta_path = get_index_meta_path()
    meta = _load_index_meta(meta_path)

    try:
        _index_file(abs_path, filename)
        md5 = _compute_file_md5(abs_path)
        meta.setdefault("files", {})[filename] = {
            "md5": md5,
            "indexed_at": datetime.now(timezone.utc).isoformat(),
        }
        _save_index_meta(meta_path, meta)
        return f"已索引: {filename}"
    except Exception as e:
        return f"索引失败 {filename}: {e}"


def _index_file(abs_path: str, rel_path: str):
    """将单个 MD 文件内容插入 LightRAG"""
    from .rag_engine import insert_document

    with open(abs_path, "r", encoding="utf-8") as f:
        content = f.read()

    if not content.strip():
        logger.warning(f"跳过空文件: {rel_path}")
        return

    insert_document(content, file_path=rel_path)

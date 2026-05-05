"""Wiki 工具（单例） - 索引导航全在 WikiManager 类里"""
import json
import os
import threading
import time as _time
import hashlib
import io
import sys
import logging
from datetime import datetime, timezone

from .wiki_file import WikiFile

logger = logging.getLogger(__name__)

# ── 索引进度全局状态 ──────────────────────────────────────────────────────
_index_progress = {
    "running": False,
    "done": 0,
    "total": 0,
    "current_file": "",
    "status": "idle",
    "result": None,
}

_INDEX_LOG_BUFFER = []
_INDEX_LOG_MAX = 20


def _log_buffer_write(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    _INDEX_LOG_BUFFER.append(line)
    if len(_INDEX_LOG_BUFFER) > _INDEX_LOG_MAX:
        del _INDEX_LOG_BUFFER[:len(_INDEX_LOG_BUFFER) - _INDEX_LOG_MAX]


# ── WikiManager ──────────────────────────────────────────────────────────
class WikiManager:
    _instance = None

    def __init__(self):
        self._wiki_watcher = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    # ── 工具函数 ────────────────────────────────────────────────────────
    def _compute_file_md5(self, file_path: str) -> str:
        h = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                h.update(chunk)
        return h.hexdigest()

    def _load_index_meta(self, meta_path: str) -> dict:
        if os.path.exists(meta_path):
            with open(meta_path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {"files": {}}

    def _save_index_meta(self, meta_path: str, meta: dict):
        os.makedirs(os.path.dirname(meta_path), exist_ok=True)
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)

    def scan_wiki_files(self, wiki_dir: str) -> list[str]:
        if not os.path.isdir(wiki_dir):
            return []
        md_files = []
        for root, _dirs, files in os.walk(wiki_dir):
            for f in sorted(files):
                if f.lower().endswith(".md"):
                    md_files.append(os.path.join(root, f))
        return md_files

    def _index_file(self, abs_path: str, rel_path: str) -> bool:
        """将单个 MD 文件内容插入 LightRAG，并通过 aget_docs_by_track_id 验证处理完成"""
        from rag.lightrag_wiki.rag_engine import insert_document, _verify_vector_inserted

        with open(abs_path, "r", encoding="utf-8") as f:
            content = f.read()

        if not content.strip():
            return True

        track_id = insert_document(content, file_path=rel_path)

        if not _verify_vector_inserted(rel_path, track_id, timeout=30):
            return False

        return True

    def index_single_file(self, filename: str) -> str:
        """索引单个文件"""
        from rag.lightrag_wiki.config import get_wiki_dir, get_index_meta_path

        wiki_dir = get_wiki_dir()
        abs_path = os.path.join(wiki_dir, filename)

        if not os.path.exists(abs_path):
            return f"文件不存在: {filename}"

        meta_path = get_index_meta_path()
        meta = self._load_index_meta(meta_path)

        try:
            verified = self._index_file(abs_path, filename)
            if not verified:
                return f"向量验证失败: {filename}"
            md5 = self._compute_file_md5(abs_path)
            meta.setdefault("files", {})[filename] = {
                "md5": md5,
                "indexed_at": datetime.now(timezone.utc).isoformat(),
            }
            self._save_index_meta(meta_path, meta)
            return f"已索引: {filename}"
        except Exception as e:
            return f"索引失败 {filename}: {e}"

    def sync_index(self) -> dict:
        """增量同步索引"""
        from rag.lightrag_wiki.config import get_wiki_dir, get_index_meta_path

        wiki_dir = get_wiki_dir()
        meta_path = get_index_meta_path()
        os.makedirs(wiki_dir, exist_ok=True)

        self._set_progress(0, 1, "扫描目录...", "running")

        meta = self._load_index_meta(meta_path)
        current_files = self.scan_wiki_files(wiki_dir)

        current_map = {}
        for abs_path in current_files:
            rel = os.path.relpath(abs_path, wiki_dir)
            current_map[rel] = abs_path

        indexed_files = meta.get("files", {})
        result = {"added": [], "updated": [], "deleted": [], "unchanged": 0, "errors": []}

        self._set_progress(0, 1, "扫描文件...", "running")
        to_process = []
        items = list(current_map.items())
        for rel_path, abs_path in items:
            md5 = self._compute_file_md5(abs_path)
            old_entry = indexed_files.get(rel_path)
            if old_entry is None:
                to_process.append((rel_path, abs_path, md5, "added"))
            elif old_entry.get("md5") != md5:
                to_process.append((rel_path, abs_path, md5, "updated"))
            else:
                result["unchanged"] += 1

        total = len(to_process)
        if total == 0:
            self._set_progress(0, 0, "无需处理", "done")
            _index_progress["result"] = result
            return result

        done = 0
        for i, (rel_path, abs_path, md5, action) in enumerate(to_process):
            self._set_progress(done, total, rel_path)
            try:
                old_stdout = sys.stdout
                captured = io.StringIO()
                sys.stdout = captured
                try:
                    verified = self._index_file(abs_path, rel_path)
                finally:
                    sys.stdout = old_stdout
                    output = captured.getvalue().strip()
                    if output:
                        for line in output.split('\n'):
                            line = line.strip()
                            if line:
                                _log_buffer_write(line)

                if verified:
                    indexed_files[rel_path] = {
                        "md5": md5,
                        "indexed_at": datetime.now(timezone.utc).isoformat(),
                    }
                    result[action].append(rel_path)
                    meta["files"] = indexed_files
                    self._save_index_meta(meta_path, meta)
                else:
                    result["errors"].append(f"{rel_path}: 向量验证失败")
            except Exception as e:
                result["errors"].append(f"{rel_path}: {e}")

            done += 1
            self._set_progress(done, total, rel_path)

        for rel_path in list(indexed_files.keys()):
            if rel_path not in current_map:
                del indexed_files[rel_path]
                result["deleted"].append(rel_path)

        meta["files"] = indexed_files
        self._save_index_meta(meta_path, meta)

        self._set_progress(total, total, "", "done")
        _index_progress["result"] = result
        return result

    def _set_progress(self, done, total, current_file, status="running"):
        _index_progress["running"] = (status == "running")
        _index_progress["done"] = done
        _index_progress["total"] = total
        _index_progress["current_file"] = current_file
        _index_progress["status"] = status

    def get_index_progress(self):
        return _index_progress

    def get_index_log(self, lines=50):
        tail = _INDEX_LOG_BUFFER[-lines:] if len(_INDEX_LOG_BUFFER) > lines else list(_INDEX_LOG_BUFFER)
        return {"lines": tail, "total": len(_INDEX_LOG_BUFFER)}

    def clear_index_log(self):
        global _INDEX_LOG_BUFFER
        _INDEX_LOG_BUFFER = []

    def _start_wiki_watcher(self):
        """启动 wiki 目录监听，文件变化时自动增量索引"""
        if self._wiki_watcher is not None:
            return

        try:
            from watchdog.observers import Observer
            from watchdog.events import FileSystemEventHandler, FileModifiedEvent
        except ImportError:
            logger.warning("[wiki-watcher] watchdog 未安装，无法自动监听文件变化")
            return

        from rag.lightrag_wiki.config import get_wiki_dir
        wiki_dir = get_wiki_dir()
        if not os.path.isdir(wiki_dir):
            logger.warning(f"[wiki-watcher] wiki_dir 不存在，跳过监听: {wiki_dir}")
            return

        class _WikiChangeHandler(FileSystemEventHandler):
            def on_modified(self, event):
                if isinstance(event, FileModifiedEvent) and event.src_path.lower().endswith('.md'):
                    rel = os.path.relpath(event.src_path, wiki_dir)
                    logger.info(f"[wiki-watcher] 检测到文件变化: {rel}")
                    self.index_single_file(rel)

            def on_created(self, event):
                if not event.is_directory and event.src_path.lower().endswith('.md'):
                    rel = os.path.relpath(event.src_path, wiki_dir)
                    logger.info(f"[wiki-watcher] 检测到新文件: {rel}")
                    self.index_single_file(rel)

            def on_deleted(self, event):
                if not event.is_directory and event.src_path.lower().endswith('.md'):
                    rel = os.path.relpath(event.src_path, wiki_dir)
                    logger.warning(f"[wiki-watcher] 检测到文件删除: {rel}（请手动重建索引清理残留向量）")

        observer = Observer()
        observer.schedule(_WikiChangeHandler(), wiki_dir, recursive=True)
        observer.daemon = True
        observer.start()
        self._wiki_watcher = observer
        logger.info(f"[wiki-watcher] 已启动，监听目录: {wiki_dir}")

    # ── 搜索 ────────────────────────────────────────────────────────────
    def do_wiki_search(self, query: str, mode: str, logger=None):
        from rag.lightrag_wiki.rag_engine import query_wiki_context
        from rag.lightrag_wiki.config import load_wiki_config

        cfg = load_wiki_config()
        timeout = cfg.get("search_timeout", 60)
        t0 = _time.time()

        if mode == "naive":
            result = query_wiki_context(query, mode="naive")
            total = _time.time() - t0
            return result, "naive", round(total, 1)

        try:
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(query_wiki_context, query, mode)
                result = future.result(timeout=timeout)
                total = _time.time() - t0
                if result and result.strip():
                    return result, mode, round(total, 1)
                if logger:
                    logger.warning(f"[API⚠] wiki {mode} 返回空，降级 naive")
        except concurrent.futures.TimeoutError:
            if logger:
                logger.warning(f"[API⚠] wiki {mode} 超时 ({timeout}s)，降级 naive")
        except Exception as e:
            if logger:
                logger.warning(f"[API⚠] wiki {mode} 失败: {e}，降级 naive")

        result = query_wiki_context(query, mode="naive")
        total = _time.time() - t0
        return result, "naive(fallback)", round(total, 1)

    # ── 文件列表 ─────────────────────────────────────────────────────────
    def get_wiki_file_list(self, project_root: str, logger=None):
        from rag.lightrag_wiki.config import get_wiki_dir, get_index_meta_path

        self._start_wiki_watcher()

        wiki_dir = get_wiki_dir()
        if not os.path.isdir(wiki_dir):
            return [], False

        files = self.scan_wiki_files(wiki_dir)
        meta_path = get_index_meta_path()
        indexed = os.path.exists(meta_path)
        index_meta = self._load_index_meta(meta_path) if indexed else {"files": {}}

        result = []
        for abs_path in files:
            rel_path = os.path.relpath(abs_path, wiki_dir)
            stat = os.stat(abs_path)
            try:
                with open(abs_path, "r", encoding="utf-8") as f:
                    preview = f.read(200).strip()
            except Exception:
                preview = ""
            entry = index_meta["files"].get(rel_path)
            if entry is None:
                index_status = "not_indexed"
            elif entry.get("md5") != self._compute_file_md5(abs_path):
                index_status = "out_of_sync"
            else:
                index_status = "synced"
            result.append({
                "filename": rel_path,
                "abs_path": abs_path,
                "size_bytes": stat.st_size,
                "modified": os.path.getmtime(abs_path),
                "preview": preview,
                "index_status": index_status,
            })
        return result, indexed

    # ── 索引启动 ────────────────────────────────────────────────────────
    def start_wiki_index_background(self, logger=None):
        def _run():
            try:
                self.sync_index()
            except Exception as e:
                if logger:
                    logger.error(f"[wiki-index] 后台索引失败: {e}")
            finally:
                if _index_progress["status"] == "running":
                    self._set_progress(_index_progress["done"], _index_progress["total"], "", "done")

        global _index_progress
        if _index_progress["running"]:
            return False, "索引任务正在进行中"

        self._set_progress(0, 0, "", "running")
        threading.Thread(target=_run, daemon=True).start()
        return True, "已启动"

    # ── 日志 ────────────────────────────────────────────────────────────
    def get_wiki_filtered_log(self, project_root: str, keywords: list[str], lines: int = 200):
        from modules.Log.log_mod import LogManager
        _log_mgr = LogManager.get_instance()
        _, fname = _log_mgr.get_latest_log_file(project_root)
        if not fname:
            return {"lines": [], "file": None}
        result = _log_mgr.read_log_tail_filtered(os.path.join(project_root, 'logs', fname), keywords, lines)
        result["file"] = fname
        return result

    # ── 设置 ────────────────────────────────────────────────────────────
    _LLM_FLAT_MAP = {
        "provider": "llm_provider",
        "model": "llm_model",
        "api_key": "llm_api_key",
        "base_url": "llm_base_url",
    }

    def get_wiki_settings(self) -> dict:
        from rag.lightrag_wiki.config import load_wiki_config
        cfg = load_wiki_config()
        llm_nested = {}
        for nested_key, flat_key in self._LLM_FLAT_MAP.items():
            val = cfg.get(flat_key, "")
            if val:
                llm_nested[nested_key] = val
        result = {k: v for k, v in cfg.items() if not k.startswith("llm_")}
        if llm_nested:
            result["llm"] = llm_nested
            if llm_nested.get("api_key"):
                result["llm"]["api_key"] = "****"
        return result

    def save_wiki_settings(self, data: dict) -> bool:
        from rag.lightrag_wiki.config import load_wiki_config, _get_config_path
        config_path = _get_config_path()
        current = load_wiki_config()
        allowed = {'wiki_dir', 'lightrag_dir', 'language', 'chunk_token_size', 'search_timeout'}
        for key in allowed:
            if key in data:
                current[key] = data[key]
        if 'llm' in data:
            new_llm = data['llm']
            for nested_key, flat_key in self._LLM_FLAT_MAP.items():
                new_val = new_llm.get(nested_key)
                if nested_key == 'api_key':
                    current[flat_key] = new_val or current.get(flat_key, "")
                elif new_val:
                    current[flat_key] = new_val
        try:
            fd, tmp_path = os.mkstemp(dir=os.path.dirname(config_path), suffix='.wiki_tmp.json')
            with os.fdopen(fd, 'w', encoding='utf-8') as f:
                json.dump(current, f, indent=2, ensure_ascii=False)
            os.replace(tmp_path, config_path)
            return True
        except Exception:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
            raise

"""记忆 CRUD 路由：/store, /search, /list, /delete, /organize"""
import logging
from flask import request, jsonify

from modules.brain.memory import (
    store_memory, search_memory, list_memories,
    delete_memory, update_memory, organize_memories
)

logger = logging.getLogger('memory')


def register(app, stats_db):
    import threading

    @app.route('/store', methods=['POST'])
    def store():
        """用户手动存储，不记录到记忆流"""
        data = request.get_json()
        text = (data or {}).get('text', '').strip()
        if not text:
            return jsonify({"error": "内容不能为空"})
        try:
            result = store_memory(text)
            stats_db.record_action(added=1)
            return jsonify(result)
        except Exception as e:
            return jsonify({"error": str(e)})

    @app.route('/search', methods=['POST'])
    def search():
        """用户手动搜索，不记录到记忆流；MCP来源也不记录搜索历史"""
        data = request.get_json()
        query = (data or {}).get('query', '').strip()
        ua = request.headers.get('User-Agent', '')
        is_mcp = 'python' in ua.lower() or 'urllib' in ua.lower()
        logger.info(f"[TRACE] /search called | query={query[:80]!r} | remote={request.remote_addr} | ua={ua[:60]!r} | is_mcp={is_mcp}")
        if not query:
            return jsonify({"results": []})
        try:
            results = search_memory(query)
            if not is_mcp:
                stats_db.add_search_history(query)
                logger.info(f"[TRACE] /search → add_search_history written | query={query[:80]!r}")
            else:
                logger.info(f"[TRACE] /search → skipped add_search_history (MCP source) | query={query[:80]!r}")
            return jsonify({"results": results})
        except Exception as e:
            return jsonify({"error": str(e), "results": []})

    @app.route('/mcp/store', methods=['POST'])
    def mcp_store():
        """MCP专用存储，走独立API，需要记录到记忆流"""
        data = request.get_json()
        text = (data or {}).get('text', '').strip()
        if not text:
            return jsonify({"error": "内容不能为空"})
        try:
            result = store_memory(text)
            stats_db.record_action(added=1)
            stats_db.append_stream('store', content=text)
            return jsonify(result)
        except Exception as e:
            return jsonify({"error": str(e)})

    @app.route('/mcp/search', methods=['POST'])
    def mcp_search():
        """MCP专用搜索，走独立API，需要记录到记忆流"""
        data = request.get_json()
        query = (data or {}).get('query', '').strip()
        logger.info(f"[TRACE] /mcp/search called | query={query[:80]!r} | remote={request.remote_addr} | path={request.path}")
        if not query:
            return jsonify({"results": []})
        try:
            results = search_memory(query)
            stats_db.append_stream('search', content=query)
            return jsonify({"results": results})
        except Exception as e:
            return jsonify({"error": str(e), "results": []})

    @app.route('/list', methods=['POST'])
    def list_route():
        data = request.get_json() or {}
        offset = data.get('offset', 0)
        limit = data.get('limit', 200)
        try:
            memories = list_memories(offset=offset, limit=limit)
            return jsonify({"memories": memories})
        except Exception as e:
            return jsonify({"error": str(e), "memories": []})

    @app.route('/delete', methods=['POST'])
    def delete():
        data = request.get_json() or {}
        memory_id = (data or {}).get('memory_id', '').strip()
        if not memory_id:
            return jsonify({"error": "缺少 memory_id"})
        try:
            result = delete_memory(memory_id)
            stats_db.record_action(deleted=1)
            stats_db.append_stream('delete', memory_id=memory_id)
            return jsonify({"result": result})
        except Exception as e:
            return jsonify({"error": str(e)})

    @app.route('/update', methods=['POST'])
    def update():
        data = request.get_json() or {}
        memory_id = (data or {}).get('memory_id', '').strip()
        new_text = (data or {}).get('new_text', '').strip()
        if not memory_id:
            return jsonify({"error": "缺少 memory_id"})
        if not new_text:
            return jsonify({"error": "新内容不能为空"})
        try:
            result = update_memory(memory_id, new_text)
            stats_db.append_stream('update', content=new_text, memory_id=memory_id)
            return jsonify({"result": result})
        except Exception as e:
            return jsonify({"error": str(e)})

    @app.route('/update-async', methods=['POST'])
    def update_async():
        """异步更新记忆，立即返回，更新在后台执行"""
        data = request.get_json() or {}
        memory_id = (data or {}).get('memory_id', '').strip()
        new_text = (data or {}).get('new_text', '').strip()
        if not memory_id:
            return jsonify({"error": "缺少 memory_id"})
        if not new_text:
            return jsonify({"error": "新内容不能为空"})
        try:
            def _do_update():
                try:
                    update_memory(memory_id, new_text)
                    stats_db.append_stream('update', content=new_text, memory_id=memory_id)
                except Exception:
                    pass
            threading.Thread(target=_do_update, daemon=True).start()
            return jsonify({"result": "更新已提交后台"})
        except Exception as e:
            return jsonify({"error": str(e)})

    @app.route('/search-history', methods=['GET'])
    def get_search_history():
        """获取搜索历史"""
        try:
            history = stats_db.get_search_history(limit=20)
            return jsonify({"history": history})
        except Exception as e:
            return jsonify({"error": str(e), "history": []})

    @app.route('/search-history', methods=['DELETE'])
    def clear_search_history():
        """清空搜索历史"""
        try:
            stats_db.clear_search_history()
            return jsonify({"ok": True})
        except Exception as e:
            return jsonify({"error": str(e)})

    @app.route('/organize', methods=['POST'])
    def organize():
        data = request.get_json() or {}
        query = (data or {}).get('query', '').strip()
        if not query:
            return jsonify({"error": "查询词不能为空"})
        try:
            result = organize_memories(query)
            stats_db.append_stream('organize', query=query, total=result.get('total_found', 0))
            return jsonify(result)
        except Exception as e:
            return jsonify({"error": str(e)})

"""记忆 CRUD 路由：/store, /search, /list, /delete"""
from flask import request, jsonify


def register(app, stats_db):
    @app.route('/store', methods=['POST'])
    def store():
        data = request.get_json()
        text = (data or {}).get('text', '').strip()
        if not text:
            return jsonify({"error": "内容不能为空"})
        try:
            from mcp_qdrant._core import store_memory
            result = store_memory(text)
            stats_db.record_action(added=1)
            # 写入流
            mid = (result or {}).get('id', '') if isinstance(result, dict) else ''
            stats_db.append_stream('store', content=text, memory_id=mid)
            return jsonify({"result": result})
        except Exception as e:
            return jsonify({"error": str(e)})

    @app.route('/search', methods=['POST'])
    def search():
        data = request.get_json()
        query = (data or {}).get('query', '').strip()
        if not query:
            return jsonify({"results": []})
        try:
            from mcp_qdrant._core import search_memory
            results = search_memory(query)
            # 写入流
            stats_db.append_stream('search', content=query)
            return jsonify({"results": results})
        except Exception as e:
            return jsonify({"error": str(e), "results": []})

    @app.route('/list', methods=['POST'])
    def list_memories():
        try:
            from mcp_qdrant._core import list_memories as _list
            memories = _list()
            return jsonify({"memories": memories})
        except Exception as e:
            return jsonify({"error": str(e), "memories": []})

    @app.route('/delete', methods=['POST'])
    def delete():
        data = request.get_json()
        memory_id = (data or {}).get('memory_id', '').strip()
        if not memory_id:
            return jsonify({"error": "缺少 memory_id"})
        try:
            from mcp_qdrant._core import delete_memory
            result = delete_memory(memory_id)
            stats_db.record_action(deleted=1)
            # 写入流
            stats_db.append_stream('delete', memory_id=memory_id)
            return jsonify({"result": result})
        except Exception as e:
            return jsonify({"error": str(e)})

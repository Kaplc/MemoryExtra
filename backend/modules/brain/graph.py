"""
SQLite 图记忆层 - 实体枢纽链接
图结构：Memory 节点通过 MENTIONS 边连接 Entity 枢纽节点
实体由调用方在保存时显式传入，不需要 LLM 提取
"""
import logging
import os
import sqlite3

logger = logging.getLogger('graph')

_GRAPH_DB_PATH = os.path.join(
    os.path.expanduser("~"), ".aibrain", "data", "memory_graph.db"
)

_INSTANCE = None

_DEFAULT_ENTITIES = [
    ("自己", "self"),
    ("用户", "user"),
    ("事实", "rule"),
    ("经验", "exp"),
]

_CREATE_TABLES = """
CREATE TABLE IF NOT EXISTS memory_nodes (
    mem0_id TEXT PRIMARY KEY,
    text TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS entity_nodes (
    name TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'concept'
);
CREATE TABLE IF NOT EXISTS mentions (
    mem0_id TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    PRIMARY KEY (mem0_id, entity_name),
    FOREIGN KEY (mem0_id) REFERENCES memory_nodes(mem0_id) ON DELETE CASCADE,
    FOREIGN KEY (entity_name) REFERENCES entity_nodes(name) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_mentions_entity ON mentions(entity_name);
CREATE INDEX IF NOT EXISTS idx_mentions_memory ON mentions(mem0_id);
CREATE TABLE IF NOT EXISTS entity_relations (
    from_entity TEXT NOT NULL,
    to_entity TEXT NOT NULL,
    PRIMARY KEY (from_entity, to_entity),
    FOREIGN KEY (from_entity) REFERENCES entity_nodes(name) ON DELETE CASCADE,
    FOREIGN KEY (to_entity) REFERENCES entity_nodes(name) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_relations_from ON entity_relations(from_entity);
CREATE INDEX IF NOT EXISTS idx_relations_to ON entity_relations(to_entity);
"""


class GraphMemory:
    def __init__(self, db_path: str):
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA foreign_keys=ON")
        self._conn.executescript(_CREATE_TABLES)
        self._init_default_entities()
        logger.info(f"[graph] initialized at {db_path}")

    def _exec(self, sql: str, params=()) -> list[tuple]:
        cur = self._conn.execute(sql, params)
        return cur.fetchall()

    def _init_default_entities(self):
        """初始化默认根实体"""
        for name, etype in _DEFAULT_ENTITIES:
            self._exec(
                "INSERT OR IGNORE INTO entity_nodes (name, type) VALUES (?, ?)",
                (name, etype),
            )
        self._conn.commit()
        logger.info(f"[graph] default entities: {[e[0] for e in _DEFAULT_ENTITIES]}")

    # ── 公开 API ──────────────────────────────────────────────

    def link_memory(self, mem0_id: str, text: str, link_entities: list[str] = None):
        """存储记忆节点，用传入的实体建边链接。

        link_entities 每项格式为「旧实体-新实体」或纯实体名。
        纯实体名直接建边；「旧实体-新实体」则新旧实体都建边（记忆→新实体，旧实体→新实体关联）。
        """
        logger.debug(f"[graph:link] mem0_id={mem0_id[:8]} link_entities={link_entities}")

        if not link_entities:
            try:
                self._exec(
                    "INSERT OR REPLACE INTO memory_nodes (mem0_id, text) VALUES (?, ?)",
                    (mem0_id, text),
                )
                self._conn.commit()
                logger.info(f"[graph:link] {mem0_id[:8]} → 0 entities (no link)")
            except Exception as e:
                self._conn.rollback()
                logger.warning(f"[graph:link] failed: {e}")
            return

        try:
            self._exec(
                "INSERT OR REPLACE INTO memory_nodes (mem0_id, text) VALUES (?, ?)",
                (mem0_id, text),
            )
            for item in link_entities:
                if not item:
                    continue
                # 解析「旧实体-新实体」格式
                if '-' in item:
                    old_entity, new_entity = item.split('-', 1)
                    old_entity = old_entity.strip()
                    new_entity = new_entity.strip()
                else:
                    old_entity = None
                    new_entity = item.strip()

                logger.info(f"[graph:link] parse item={item!r} → old={old_entity!r} new={new_entity!r}")

                if new_entity:
                    self._exec(
                        "INSERT OR IGNORE INTO entity_nodes (name, type) VALUES (?, 'concept')",
                        (new_entity,),
                    )
                    self._exec(
                        "INSERT OR IGNORE INTO mentions (mem0_id, entity_name) VALUES (?, ?)",
                        (mem0_id, new_entity),
                    )
                    logger.info(f"[graph:link] → inserted new_entity={new_entity!r}")
                if old_entity:
                    self._exec(
                        "INSERT OR IGNORE INTO entity_nodes (name, type) VALUES (?, 'concept')",
                        (old_entity,),
                    )
                    self._exec(
                        "INSERT OR IGNORE INTO entity_relations (from_entity, to_entity) VALUES (?, ?)",
                        (old_entity, new_entity),
                    )
                    logger.info(f"[graph:link] → inserted relation {old_entity!r} → {new_entity!r}")
            self._conn.commit()
            logger.info(f"[graph:link] {mem0_id[:8]} → {len(link_entities)} items")
        except Exception as e:
            self._conn.rollback()
            logger.warning(f"[graph:link] failed: {e}")

    def link_if_no_entities(self, mem0_id: str, text: str):
        """如果该记忆在图中没有任何实体链接，自动关联到根实体'用户'"""
        rows = self._exec(
            "SELECT COUNT(*) FROM mentions WHERE mem0_id = ?",
            (mem0_id,),
        )
        if rows and rows[0][0] > 0:
            return  # 已有实体链接，跳过
        try:
            self._exec(
                "INSERT OR REPLACE INTO memory_nodes (mem0_id, text) VALUES (?, ?)",
                (mem0_id, text),
            )
            self._exec(
                "INSERT OR IGNORE INTO mentions (mem0_id, entity_name) VALUES (?, '用户')",
                (mem0_id,),
            )
            self._conn.commit()
            logger.info(f"[graph:backfill] {mem0_id[:8]} 无实体链接，自动关联→用户")
        except Exception as e:
            self._conn.rollback()
            logger.warning(f"[graph:backfill] failed: {e}")

    def list_entities(self) -> list[dict]:
        """列出所有实体"""
        rows = self._exec(
            """SELECT e.name, e.type, COUNT(mn.mem0_id) as memory_count
               FROM entity_nodes e
               LEFT JOIN mentions mn ON e.name = mn.entity_name
               GROUP BY e.name, e.type
               ORDER BY memory_count DESC, e.name"""
        )
        return [{"name": r[0], "type": r[1], "memory_count": r[2]} for r in rows]

    def search_related(self, mem0_ids: list[str], max_hops: int = 2) -> list[dict]:
        """从向量命中的记忆出发，多跳遍历找关联记忆"""
        if not mem0_ids:
            return []
        logger.info(f"[graph:search_related] 启动多跳遍历 | 起始记忆数={len(mem0_ids)} | max_hops={max_hops} | 起始ID={[m[:8] for m in mem0_ids]}")
        placeholders = ",".join("?" * len(mem0_ids))
        sql = f"""
            WITH RECURSIVE reachable(mem0_id, hop) AS (
                SELECT DISTINCT m2.mem0_id, 1
                FROM mentions mn1
                JOIN mentions mn2 ON mn1.entity_name = mn2.entity_name
                JOIN memory_nodes m2 ON m2.mem0_id = mn2.mem0_id
                WHERE mn1.mem0_id IN ({placeholders})
                AND m2.mem0_id NOT IN ({placeholders})
                UNION
                SELECT DISTINCT m3.mem0_id, r.hop + 1
                FROM reachable r
                JOIN mentions mn_r ON mn_r.mem0_id = r.mem0_id
                JOIN mentions mn_new ON mn_r.entity_name = mn_new.entity_name
                JOIN memory_nodes m3 ON m3.mem0_id = mn_new.mem0_id
                WHERE r.hop < ?
                AND m3.mem0_id NOT IN ({placeholders})
            )
            SELECT DISTINCT r.mem0_id, m.text FROM reachable r
            JOIN memory_nodes m ON m.mem0_id = r.mem0_id
            LIMIT 30
        """
        try:
            rows = self._exec(sql, mem0_ids + mem0_ids + [max_hops] + mem0_ids)
            result = [{"id": r[0], "text": r[1]} for r in rows]
            logger.info(f"[graph:search_related] 图扩展完成 | 发现 {len(result)} 条关联记忆 | IDs={[r['id'][:8] for r in result]}")
            return result
        except Exception as e:
            logger.warning(f"[graph:search_related] failed: {e}")
            return []

    def get_entities_for_memories(self, mem0_ids: list[str]) -> dict[str, list[str]]:
        """批量查询记忆关联的实体名"""
        if not mem0_ids:
            return {}
        logger.debug(f"[graph:get_entities] ids={[m[:8] for m in mem0_ids]}")
        placeholders = ",".join("?" * len(mem0_ids))
        sql = f"""
            SELECT m.mem0_id, GROUP_CONCAT(e.name, '||') as entities
            FROM memory_nodes m
            JOIN mentions mn ON m.mem0_id = mn.mem0_id
            JOIN entity_nodes e ON mn.entity_name = e.name
            WHERE m.mem0_id IN ({placeholders})
            GROUP BY m.mem0_id
        """
        try:
            rows = self._exec(sql, mem0_ids)
            result = {r[0]: r[1].split("||") if r[1] else [] for r in rows}
            logger.debug(f"[graph:get_entities] result={result}")
            return result
        except Exception as e:
            logger.warning(f"[graph:get_entities] failed: {e}")
            return {}

    def search_entity(self, name: str) -> dict:
        """查询实体是否存在，返回关联记忆和关联实体"""
        logger.info(f"[graph:search_entity] name={name!r}")
        rows = self._exec(
            "SELECT name, type FROM entity_nodes WHERE name LIKE ?",
            (f"%{name}%",),
        )
        logger.info(f"[graph:search_entity] entity_nodes query returned: {rows}")
        if not rows:
            return {"exists": False}

        entity_name = rows[0][0]
        entity_type = rows[0][1]

        mem_rows = self._exec(
            """SELECT m.mem0_id, m.text FROM memory_nodes m
               JOIN mentions mn ON m.mem0_id = mn.mem0_id
               WHERE mn.entity_name LIKE ?""",
            (f"%{name}%",),
        )
        memories = [{"mem0_id": r[0], "text": r[1]} for r in mem_rows]

        related_rows = self._exec(
            """SELECT DISTINCT e2.name, e2.type FROM mentions mn1
               JOIN mentions mn2 ON mn1.mem0_id = mn2.mem0_id
               JOIN entity_nodes e2 ON mn2.entity_name = e2.name
               WHERE mn1.entity_name LIKE ? AND e2.name NOT LIKE ?
               LIMIT 10""",
            (f"%{name}%", f"%{name}%"),
        )
        logger.info(f"[graph:search_entity] related_entities (mentions) query returned: {related_rows}")

        # 多层深度召回：从深度1开始迭代扩展到 max_depth 层
        max_depth = 3
        frontier = [entity_name]
        visited = {entity_name}
        depth_results = {}

        for depth in range(1, max_depth + 1):
            next_frontier = []
            for current in frontier:
                rows = self._exec(
                    "SELECT to_entity FROM entity_relations WHERE from_entity = ?",
                    (current,),
                )
                for r in rows:
                    next_entity = r[0]
                    if next_entity not in visited:
                        visited.add(next_entity)
                        depth_results.setdefault(depth, []).append(next_entity)
                        next_frontier.append(next_entity)
            frontier = next_frontier
            if not frontier:
                break

        all_related_names = []
        for d in range(2, max_depth + 1):
            all_related_names.extend(depth_results.get(d, []))
        all_related_names = list(set(all_related_names))

        # 收集所有涉及的记忆：根实体 + 深度2+ 实体的 mentions
        all_entity_names = [entity_name] + all_related_names
        if all_entity_names:
            placeholders = ','.join('?' * len(all_entity_names))
            mem_rows = self._exec(
                f"""SELECT m.mem0_id, m.text FROM memory_nodes m
                   JOIN mentions mn ON m.mem0_id = mn.mem0_id
                   WHERE mn.entity_name IN ({placeholders})""",
                all_entity_names,
            )
            memories = [{"mem0_id": r[0], "text": r[1]} for r in mem_rows]

        related = []
        if all_related_names:
            placeholders = ','.join('?' * len(all_related_names))
            rel_rows = self._exec(
                f"SELECT name, type FROM entity_nodes WHERE name IN ({placeholders})",
                all_related_names,
            )
            related = [{"name": r[0], "type": r[1]} for r in rel_rows]

        logger.info(f"[graph:search_entity] depth={max_depth} results: {depth_results}")
        logger.info(f"[graph:search_entity] final memories count={len(memories)}, related_entities count={len(related)}")

        return {
            "exists": True,
            "name": entity_name,
            "type": entity_type,
            "memories": memories,
            "related_entities": related,
        }

    def delete_memory(self, mem0_id: str):
        """删除记忆节点及其边"""
        try:
            self._exec("DELETE FROM mentions WHERE mem0_id = ?", (mem0_id,))
            self._exec("DELETE FROM memory_nodes WHERE mem0_id = ?", (mem0_id,))
            self._conn.commit()
            logger.info(f"[graph] deleted memory {mem0_id[:8]}")
        except Exception as e:
            self._conn.rollback()
            logger.warning(f"[graph] delete_memory failed: {e}")

    def get_stats(self) -> dict:
        """返回图中节点和边数量"""
        try:
            mem_count = self._exec("SELECT COUNT(*) FROM memory_nodes")[0][0]
            ent_count = self._exec("SELECT COUNT(*) FROM entity_nodes")[0][0]
            edge_count = self._exec("SELECT COUNT(*) FROM mentions")[0][0]
            return {
                "memory_count": mem_count,
                "entity_count": ent_count,
                "edge_count": edge_count,
            }
        except Exception as e:
            logger.warning(f"[graph] get_stats failed: {e}")
            return {"memory_count": 0, "entity_count": 0, "edge_count": 0}


def get_graph() -> GraphMemory | None:
    """全局单例，初始化失败返回 None"""
    global _INSTANCE
    if _INSTANCE is not None:
        return _INSTANCE
    try:
        os.makedirs(os.path.dirname(_GRAPH_DB_PATH), exist_ok=True)
        _INSTANCE = GraphMemory(_GRAPH_DB_PATH)
        return _INSTANCE
    except Exception as e:
        logger.warning(f"[graph] initialization failed (non-fatal): {e}")
        return None
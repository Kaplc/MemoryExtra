"""测试图记忆层的实体枢纽链接搜索"""
import os
import tempfile

import pytest

from backend.modules.brain.graph import GraphMemory


@pytest.fixture
def graph():
    """用临时数据库创建 GraphMemory 实例"""
    db_path = os.path.join(tempfile.gettempdir(), "test_graph_entity.db")
    g = GraphMemory(db_path)
    yield g
    # 清理
    g._conn.close()
    try:
        os.remove(db_path)
        for suffix in ("-wal", "-shm"):
            p = db_path + suffix
            if os.path.exists(p):
                os.remove(p)
    except Exception:
        pass


def _link(g, mid, text, entities=None):
    """直接用 link_entities 绕过 LLM 提取"""
    g.link_memory(mid, text, link_entities=entities)


class TestLinkAndSearchRelated:
    """存储记忆 → 通过共享实体发现关联记忆"""

    def test_two_memories_share_entity(self, graph):
        """两条记忆共享实体 '志远'，search_related 能互相找到"""
        _link(graph, "m1", "志远喜欢猫", entities=["志远", "猫"])
        _link(graph, "m2", "志远养了一只橘猫", entities=["志远", "橘猫"])

        related = graph.search_related(["m1"])
        assert len(related) == 1
        assert related[0]["id"] == "m2"
        assert "橘猫" in related[0]["text"]

    def test_no_shared_entity_no_result(self, graph):
        """没有共享实体的记忆不应被找到"""
        _link(graph, "m1", "今天天气很好", entities=["天气"])
        _link(graph, "m2", "Python是一种编程语言", entities=["Python"])

        related = graph.search_related(["m1"])
        assert len(related) == 0

    def test_three_memories_chain(self, graph):
        """三跳链式关联：m1→志远→m2→猫→m3"""
        _link(graph, "m1", "志远喜欢猫", entities=["志远", "猫"])
        _link(graph, "m2", "志远养了一只橘猫", entities=["志远", "橘猫"])
        _link(graph, "m3", "橘猫叫小花", entities=["橘猫", "小花"])

        # m1 通过志远找到 m2，m2 通过橘猫找到 m3
        related = graph.search_related(["m1"], max_hops=2)
        ids = {r["id"] for r in related}
        assert "m2" in ids
        assert "m3" in ids

    def test_one_hop_only(self, graph):
        """max_hops=1 只能找到直接共享实体的记忆"""
        _link(graph, "m1", "志远喜欢猫", entities=["志远", "猫"])
        _link(graph, "m2", "志远养了一只橘猫", entities=["志远", "橘猫"])
        _link(graph, "m3", "橘猫叫小花", entities=["橘猫", "小花"])

        related = graph.search_related(["m1"], max_hops=1)
        ids = {r["id"] for r in related}
        assert "m2" in ids
        assert "m3" not in ids  # 需要两跳才能到达


class TestGetEntitiesForMemories:
    """查询记忆关联的实体"""

    def test_returns_entities_for_each_memory(self, graph):
        _link(graph, "m1", "志远喜欢猫", entities=["志远", "猫"])
        _link(graph, "m2", "志远养了一只橘猫", entities=["志远", "橘猫"])

        result = graph.get_entities_for_memories(["m1", "m2"])
        assert set(result["m1"]) == {"志远", "猫"}
        assert set(result["m2"]) == {"志远", "橘猫"}

    def test_no_entities_for_unknown_memory(self, graph):
        result = graph.get_entities_for_memories(["nonexistent"])
        assert result == {}

    def test_empty_ids(self, graph):
        result = graph.get_entities_for_memories([])
        assert result == {}


class TestSearchEntity:
    """实体查询"""

    def test_entity_exists(self, graph):
        _link(graph, "m1", "志远喜欢猫", entities=["志远", "猫"])

        result = graph.search_entity("志远")
        assert result["exists"] is True
        assert result["name"] == "志远"
        assert len(result["memories"]) == 1
        assert result["memories"][0]["mem0_id"] == "m1"

    def test_entity_not_exists(self, graph):
        result = graph.search_entity("不存在")
        assert result["exists"] is False

    def test_related_entities(self, graph):
        _link(graph, "m1", "志远喜欢猫", entities=["志远", "猫"])
        _link(graph, "m2", "志远养了一只橘猫", entities=["志远", "橘猫"])

        result = graph.search_entity("志远")
        related_names = {e["name"] for e in result["related_entities"]}
        assert "猫" in related_names
        assert "橘猫" in related_names


class TestValidateEntities:
    """实体验证"""

    def test_all_exist(self, graph):
        _link(graph, "m1", "text", entities=["志远", "猫"])

        missing = graph.validate_entities(["志远", "猫"])
        assert missing == []

    def test_some_missing(self, graph):
        _link(graph, "m1", "text", entities=["志远"])

        missing = graph.validate_entities(["志远", "不存在"])
        assert missing == ["不存在"]

    def test_all_missing(self, graph):
        missing = graph.validate_entities(["a", "b"])
        assert set(missing) == {"a", "b"}

    def test_empty_list(self, graph):
        missing = graph.validate_entities([])
        assert missing == []


class TestDeleteMemory:
    """删除记忆清理图"""

    def test_delete_removes_from_search(self, graph):
        _link(graph, "m1", "志远喜欢猫", entities=["志远", "猫"])
        _link(graph, "m2", "志远养了一只橘猫", entities=["志远", "橘猫"])

        graph.delete_memory("m1")

        related = graph.search_related(["m2"])
        ids = {r["id"] for r in related}
        assert "m1" not in ids

    def test_delete_updates_stats(self, graph):
        _link(graph, "m1", "text", entities=["志远"])
        stats_before = graph.get_stats()
        assert stats_before["memory_count"] == 1
        assert stats_before["edge_count"] == 1

        graph.delete_memory("m1")
        stats_after = graph.get_stats()
        assert stats_after["memory_count"] == 0
        assert stats_after["edge_count"] == 0


class TestGetStats:
    """统计信息"""

    def test_empty_graph(self, graph):
        stats = graph.get_stats()
        assert stats["memory_count"] == 0
        assert stats["entity_count"] == 0
        assert stats["edge_count"] == 0

    def test_after_links(self, graph):
        _link(graph, "m1", "志远喜欢猫", entities=["志远", "猫"])
        stats = graph.get_stats()
        assert stats["memory_count"] == 1
        assert stats["entity_count"] == 2
        assert stats["edge_count"] == 2

    def test_shared_entity_no_duplicate(self, graph):
        _link(graph, "m1", "志远喜欢猫", entities=["志远", "猫"])
        _link(graph, "m2", "志远养了橘猫", entities=["志远", "橘猫"])
        stats = graph.get_stats()
        assert stats["entity_count"] == 3  # 志远, 猫, 橘猫（志远不重复）
        assert stats["edge_count"] == 4


class TestEntityExpansionSearch:
    """模拟完整搜索流程：向量搜索结果 → 图实体扩展"""

    def test_full_expansion_flow(self, graph):
        """模拟：向量搜索命中 m1 → 图扩展通过共享实体找到 m2, m3"""
        # 建图
        _link(graph, "m1", "志远喜欢猫", entities=["志远", "猫"])
        _link(graph, "m2", "志远养了一只橘猫", entities=["志远", "橘猫"])
        _link(graph, "m3", "橘猫叫小花喜欢睡觉", entities=["橘猫", "小花"])
        _link(graph, "m4", "Python是编程语言", entities=["Python"])

        # 模拟向量搜索命中 m1
        vector_ids = ["m1"]

        # 1. 获取向量结果的实体
        entity_map = graph.get_entities_for_memories(vector_ids)
        assert set(entity_map["m1"]) == {"志远", "猫"}

        # 2. 图扩展找关联
        related = graph.search_related(vector_ids, max_hops=2)
        related_ids = {r["id"] for r in related}

        # m1→志远→m2, m2→橘猫→m3
        assert "m2" in related_ids
        assert "m3" in related_ids
        assert "m4" not in related_ids  # 无关记忆

        # 3. 获取扩展结果的实体
        all_ids = vector_ids + [r["id"] for r in related]
        full_entity_map = graph.get_entities_for_memories(all_ids)
        assert set(full_entity_map["m2"]) == {"志远", "橘猫"}
        assert set(full_entity_map["m3"]) == {"橘猫", "小花"}

    def test_store_with_link_entities_validation(self, graph):
        """模拟：保存时验证 link_entities 是否存在"""
        _link(graph, "m1", "志远喜欢猫", entities=["志远", "猫"])

        # 已有实体 → 验证通过
        missing = graph.validate_entities(["志远"])
        assert missing == []

        # 不存在的实体 → 验证失败
        missing = graph.validate_entities(["志远", "不存在的实体"])
        assert missing == ["不存在的实体"]

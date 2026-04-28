"""
记忆去重模块 - 基于 Embedding 相似度的全量去重分组
两步法第一步：用向量余弦相似度 + 并查集找出语义重复的记忆组
"""
import logging
import numpy as np

from brain_mcp.embedding import encode_texts

logger = logging.getLogger(__name__)

# 相似度阈值档位
THRESHOLD_STRICT = 0.90
THRESHOLD_MEDIUM = 0.85
THRESHOLD_LOOSE = 0.80


def _get_all_memories(client, user_id: str) -> list[dict]:
    """从 mem0 获取全部记忆"""
    result = client.get_all(filters={"user_id": user_id}, top_k=100000)
    memories = result.get("results", [])
    # 按 created_at 倒序
    memories.sort(key=lambda m: m.get("created_at", ""), reverse=True)
    return [
        {"id": m["id"], "text": m["memory"], "timestamp": m.get("created_at")}
        for m in memories
    ]


def _union_find_cluster(sim_matrix: np.ndarray, threshold: float) -> list[list[int]]:
    """并查集聚类：将相似度 >= threshold 的记忆归为同一组"""
    n = len(sim_matrix)
    parent = list(range(n))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    for i in range(n):
        for j in range(i + 1, n):
            if sim_matrix[i][j] >= threshold:
                union(i, j)

    groups = {}
    for i in range(n):
        root = find(i)
        groups.setdefault(root, []).append(i)

    return [indices for indices in groups.values() if len(indices) >= 2]


def dedup_memories(threshold: float = THRESHOLD_MEDIUM) -> dict:
    """全量记忆去重分组

    Args:
        threshold: 余弦相似度阈值，默认 0.85

    Returns:
        {"groups": [...], "total_memories": N, "grouped_count": M, "ungrouped_count": K}
    """
    from modules.brain.mem0_adapter import get_mem0_client
    from modules.brain.memory import DEFAULT_USER_ID

    client = get_mem0_client()
    all_memories = _get_all_memories(client, DEFAULT_USER_ID)

    if not all_memories:
        return {"groups": [], "total_memories": 0, "grouped_count": 0, "ungrouped_count": 0}

    n = len(all_memories)
    logger.info(f"[dedup] 开始去重，共 {n} 条记忆，阈值={threshold}")

    # 批量编码
    texts = [m["text"] for m in all_memories]
    vectors = encode_texts(texts)

    # 转为 numpy 矩阵并归一化
    mat = np.array(vectors, dtype=np.float32)
    norms = np.linalg.norm(mat, axis=1, keepdims=True)
    mat = mat / np.maximum(norms, 1e-8)

    # 计算相似度矩阵
    sim_matrix = mat @ mat.T

    # 并查集聚类
    cluster_indices = _union_find_cluster(sim_matrix, threshold)

    # 构建分组结果
    groups = []
    grouped_indices = set()
    for indices in cluster_indices:
        grouped_indices.update(indices)

        # 计算组内平均相似度
        if len(indices) > 1:
            pairs = [(indices[a], indices[b]) for a in range(len(indices)) for b in range(a + 1, len(indices))]
            avg_sim = float(np.mean([sim_matrix[i][j] for i, j in pairs]))
        else:
            avg_sim = 1.0

        groups.append({
            "group_id": len(groups),
            "memories": [
                {
                    "id": all_memories[i]["id"],
                    "text": all_memories[i]["text"],
                    "timestamp": all_memories[i].get("timestamp"),
                }
                for i in indices
            ],
            "similarity": round(avg_sim, 4),
        })

    # 按相似度降序排列
    groups.sort(key=lambda g: g["similarity"], reverse=True)
    # 重新编号
    for i, g in enumerate(groups):
        g["group_id"] = i

    grouped_count = len(grouped_indices)
    logger.info(f"[dedup] 完成：{len(groups)} 组相似记忆，{grouped_count} 条参与去重，{n - grouped_count} 条独立")

    return {
        "groups": groups,
        "total_memories": n,
        "grouped_count": grouped_count,
        "ungrouped_count": n - grouped_count,
    }

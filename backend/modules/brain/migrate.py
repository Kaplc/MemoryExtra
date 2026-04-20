"""
旧记忆迁移 - 从旧 Qdrant memories 集合迁移到 mem0_memories
"""
import logging

logger = logging.getLogger(__name__)

# 迁移标记文件，防止重复执行
_MIGRATION_FLAG = ".mem0_migrated"


def needs_migration(project_root: str) -> bool:
    """检查是否需要迁移"""
    import os
    return not os.path.exists(os.path.join(project_root, _MIGRATION_FLAG))


def migrate_old_memories(project_root: str) -> dict:
    """从旧 Qdrant memories 集合读取所有记忆并迁移到 mem0

    Returns: {"migrated": int, "skipped": int, "error": str | None}
    """
    import os
    from qdrant_client import QdrantClient
    from brain_mcp.config import settings as brain_settings

    flag_path = os.path.join(project_root, _MIGRATION_FLAG)

    # 1. 连接旧 Qdrant，读取 memories 集合
    try:
        old_client = QdrantClient(
            host=brain_settings.qdrant_host,
            grpc_port=brain_settings.grpc_port,
            prefer_grpc=True,
            check_compatibility=False,
        )
        collections = [c.name for c in old_client.get_collections().collections]
        if brain_settings.collection_name not in collections:
            logger.info("Old memories collection not found, nothing to migrate")
            _write_flag(flag_path)
            return {"migrated": 0, "skipped": 0, "error": None}

        count = old_client.count(collection_name=brain_settings.collection_name, exact=True).count
        if count == 0:
            logger.info("Old memories collection is empty, nothing to migrate")
            _write_flag(flag_path)
            return {"migrated": 0, "skipped": 0, "error": None}

        logger.info(f"Migrating {count} memories from '{brain_settings.collection_name}'...")
    except Exception as e:
        logger.error(f"Failed to connect old Qdrant: {e}")
        return {"migrated": 0, "skipped": 0, "error": str(e)}

    # 2. 逐批读取旧记忆
    from modules.brain.mem0_adapter import get_mem0_client
    mem0_client = get_mem0_client()

    migrated = 0
    skipped = 0
    offset = None

    while True:
        results, offset = old_client.scroll(
            collection_name=brain_settings.collection_name,
            offset=offset,
            limit=100,
        )
        if not results:
            break

        for r in results:
            text = r.payload.get("text", "").strip()
            if not text or "[已整理]" in text:
                skipped += 1
                continue
            try:
                # 使用 infer=False 直接存储，避免 LLM 重新推理
                mem0_client.add(
                    text,
                    user_id="default",
                    infer=False,
                )
                migrated += 1
            except Exception as e:
                logger.warning(f"Failed to migrate memory {r.id}: {e}")
                skipped += 1

        if offset is None:
            break

    # 3. 写入迁移完成标记
    _write_flag(flag_path)
    logger.info(f"Migration complete: migrated={migrated}, skipped={skipped}")
    return {"migrated": migrated, "skipped": skipped, "error": None}


def _write_flag(flag_path: str):
    import os
    try:
        with open(flag_path, 'w') as f:
            f.write("done")
    except Exception:
        pass

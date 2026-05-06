"""
MCP Server - 只暴露 store 和 search 两个工具
mem0 全权管理记忆的存储、去重、更新、检索。
搜索策略由后端根据数据量自动适配（MCP 零配置）。

记忆分类：
  - life:  用户历史、偏好、背景  → user_id=default
  - fact:  规则、事实、知识      → agent_id=fact
  - exp: 技能、项目经历         → run_id=exp
"""
from enum import Enum
from fastmcp import FastMCP

from .tools import store_memory, search_memory

mcp = FastMCP("AiBrain Memory Server")


class MemoryCategory(str, Enum):
    """记忆分类枚举，大模型传入时使用"""
    LIFE = "life"   # 用户历史、偏好、背景
    FACT = "fact"    # 规则、事实、知识
    EXP = "exp"      # 技能、项目经历


@mcp.tool()
def store(text: str, categories: list[MemoryCategory]) -> str:
    """存储记忆。LLM 自动从文本中提取事实并存储。Args: text=记忆文本（可包含多个事实）；categories=必填，LIFE=用户历史/偏好/背景，FACT=规则/事实/知识，EXP=技能/项目经历"""
    if not categories:
        raise ValueError("categories 参数不能为空，请指定记忆分类：user / fact / exp")
    cat_list = [c.value if isinstance(c, MemoryCategory) else c for c in categories]
    return store_memory(text, categories=cat_list)


@mcp.tool()
def search(query: str, category: MemoryCategory) -> dict:
    """搜索记忆，返回文本和相关性分数。Args: query=搜索关键词；category=必填，LIFE=用户历史/偏好/背景，FACT=规则/事实/知识，EXP=技能/项目经历"""
    if not query or not query.strip():
        raise ValueError("搜索关键词不能为空")
    cat_value = category.value if isinstance(category, MemoryCategory) else category
    results = search_memory(query, category=cat_value)
    return {"query": query, "results": results}

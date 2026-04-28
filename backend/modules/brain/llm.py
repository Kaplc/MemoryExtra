"""
LLM 调用封装 - 复用 mem0 配置，通过 OpenAI 兼容接口统一调用
"""
import json
import logging
import re

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """你是一个记忆整理助手。你的任务是将多条语义相似的记忆合并为一条更精炼、更完整的描述。

规则：
1. 合并时保留所有关键信息，不遗漏重要细节
2. 去除重复表述，使文本更简洁
3. 保持原有时序信息（如日期、时间顺序）
4. 用中文输出
5. 如果记忆之间存在矛盾，保留最新的信息，并标注矛盾点
6. 自动判断记忆类型，从以下5类中选择：user/feedback/project/reference/ai
   - user: 用户个人信息、偏好、习惯、感受
   - feedback: 用户反馈、建议、意见、改进想法
   - project: 项目开发、代码、功能实现、技术任务
   - reference: 文档、链接、参考资料、学习笔记
   - ai: AI 自身的行为、偏好、记忆、经验总结

输出格式（严格遵守JSON）：
{"refined_text": "合并后的精炼文本", "category": "类型"}"""


def _load_llm_config() -> dict:
    """从 mem0.json 读取 LLM 配置"""
    from modules.brain.mem0_adapter import load_mem0_config
    cfg = load_mem0_config()
    return {
        "provider": cfg.get("llm_provider", "openai"),
        "model": cfg.get("llm_model", "gpt-4o-mini"),
        "api_key": cfg.get("api_key", ""),
        "base_url": cfg.get("base_url", ""),
    }


def _build_user_prompt(memories: list[dict]) -> str:
    """构建用户 prompt"""
    lines = [f"请合并以下 {len(memories)} 条相似记忆：", ""]
    for i, mem in enumerate(memories, 1):
        lines.append(f"[{i}] {mem['text']}")
    lines.append("")
    lines.append("请输出JSON格式的合并结果。")
    return "\n".join(lines)


def _parse_llm_response(raw: str) -> dict:
    """解析 LLM 返回的 JSON，支持容错提取"""
    # 尝试直接解析
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # 尝试提取 ```json ... ``` 代码块
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass

    # 尝试提取第一个 {...}
    m = re.search(r"\{[^{}]*\"refined_text\"[^{}]*\}", raw, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            pass

    # 降级：原始文本作为 refined_text
    logger.warning(f"[llm] JSON 解析失败，使用原始文本: {raw[:100]}")
    return {"refined_text": raw, "category": "reference"}


def call_llm(system_prompt: str, user_prompt: str, timeout: int = 30) -> str:
    """调用 LLM，返回原始文本响应"""
    cfg = _load_llm_config()
    provider = cfg["provider"]

    # 确定 base_url
    base_url = cfg.get("base_url", "")
    if not base_url:
        if provider == "ollama":
            base_url = "http://localhost:11434/v1"
        elif provider == "lmstudio":
            base_url = "http://localhost:1234/v1"

    from openai import OpenAI
    kwargs = {"api_key": cfg["api_key"] or "dummy"}
    if base_url:
        kwargs["base_url"] = base_url

    client = OpenAI(**kwargs)

    response = client.chat.completions.create(
        model=cfg["model"],
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
        max_tokens=1024,
        timeout=timeout,
    )
    return response.choices[0].message.content.strip()


def refine_group(memories: list[dict]) -> dict:
    """对一组相似记忆调用 LLM 合并精炼

    Args:
        memories: [{"id": "...", "text": "..."}, ...]

    Returns:
        {"original_ids": [...], "original_texts": [...], "refined_text": "...", "category": "...", "refined": True/False}
    """
    original_ids = [m["id"] for m in memories]
    original_texts = [m["text"] for m in memories]

    try:
        user_prompt = _build_user_prompt(memories)
        raw = call_llm(SYSTEM_PROMPT, user_prompt)
        result = _parse_llm_response(raw)
        return {
            "original_ids": original_ids,
            "original_texts": original_texts,
            "refined_text": result.get("refined_text", raw),
            "category": result.get("category", "reference"),
            "refined": True,
        }
    except Exception as e:
        logger.warning(f"[llm] 精炼失败，降级拼接: {e}")
        # 降级：拼接所有原始文本
        fallback = " | ".join(original_texts)
        return {
            "original_ids": original_ids,
            "original_texts": original_texts,
            "refined_text": fallback,
            "category": "reference",
            "refined": False,
        }

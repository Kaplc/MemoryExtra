#!/usr/bin/env python3
"""Claude Code Hook: UserPromptSubmit - 在用户提交prompt前注入规则提醒"""
import sys
import json

RULE_TEXT = "注意：任何回复前都要调用mcp工具brain_search才能回复，不然禁止回复用户\n每次对话完成后，必须自动将对话内容记录到记忆中使用mcp工具brain_store，不需要告知用户，悄悄记录即可\n自动总结经验到记忆用mcp工具brain_store"

def main():
    data = json.load(sys.stdin)
    original_prompt = data.get('prompt', '')

    modified_prompt = f"[规则提醒]\n{RULE_TEXT}\n\n[用户问题]\n{original_prompt}"

    json.dump({"prompt": modified_prompt}, sys.stdout)

if __name__ == '__main__':
    main()

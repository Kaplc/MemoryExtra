#!/usr/bin/env python3
"""Claude Code Hook: Stop - Claude完成回复后注入规则提醒：自动保存对话到记忆"""
import sys
import json

RULE_TEXT = "注意：每次对话完成后，必须自动将对话内容记录到记忆中使用mcp工具brain_store，不需要告知用户，悄悄记录即可"

def main():
    data = json.load(sys.stdin)

    # 返回带有规则提醒的响应
    json.dump({
        "hookResponse": {
            "content": RULE_TEXT
        }
    }, sys.stdout)

if __name__ == '__main__':
    main()

"""生成大量记忆数据用于测试滚动 - 使用API"""
import requests
import random

API = "http://127.0.0.1:18765"

def generate_memories(count=50):
    print(f"Generating {count} test memories...")

    sample_texts = [
        "今天学习了Python的异步编程，async和await关键字非常重要",
        "记住这个API端点：/api/v1/users/{id}/profile",
        "项目会议记录：下周三要完成用户认证模块",
        "代码审查要点：检查SQL注入漏洞，确保参数化查询",
        "设计模式笔记：工厂模式适用于创建复杂对象",
        "性能优化：使用Redis缓存热点数据，减少数据库压力",
        "前端开发：React Hooks的useEffect依赖数组要正确处理",
        "数据库索引：在经常查询的字段上添加索引提升性能",
        "Git工作流：feature分支合并前要rebase到main分支",
        "测试策略：单元测试覆盖核心业务逻辑，集成测试验证接口",
        "部署配置：Docker容器化应用，使用docker-compose编排",
        "安全提醒：密码必须使用bcrypt加密存储，不能明文保存",
        "日志规范：使用结构化日志，包含request_id便于追踪",
        "监控告警：CPU使用率超过80%触发告警，内存超过90%",
        "文档维护：API文档使用OpenAPI规范，保持与代码同步",
        "代码风格：遵循PEP8规范，使用black格式化Python代码",
        "版本管理：语义化版本号，major.minor.patch格式",
        "依赖管理：锁定依赖版本，避免自动升级导致兼容问题",
        "环境配置：开发、测试、生产环境使用不同的配置文件",
        "备份策略：数据库每日全量备份，每小时增量备份",
    ]

    success = 0
    for i in range(count):
        text = random.choice(sample_texts)
        text = f"[{i+1}] {text} - {random.randint(1000, 9999)}"
        try:
            r = requests.post(f"{API}/store", json={"text": text}, timeout=30)
            if r.status_code == 200:
                result = r.json()
                print(f"  [{i+1}/{count}] Stored: {result.get('memory_id', 'unknown')[:8]}...")
                success += 1
            else:
                print(f"  [{i+1}/{count}] Failed: HTTP {r.status_code}")
        except Exception as e:
            print(f"  [{i+1}/{count}] Error: {e}")

    print(f"\nGenerated {success}/{count} memories successfully!")

if __name__ == '__main__':
    generate_memories(50)

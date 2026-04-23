# MCP链路测试

验证 MCP → 后端通信是否正常。

## 更新记录

- 2026-04-23: wiki_write 工具已移除，改为 agent 直接修改文件后调用 wiki_index 重建索引
- brainmcp 和 wikimcp 全量测试通过
- 端口配置已修复为动态读取 .port_config
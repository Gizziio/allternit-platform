# Kimi → Allternit Gap Implementation Plan

**Generated from:** /Users/joe/Desktop/kimi-docs/kimi_allternit_gap_analysis.md
**Total gaps:** 12 | **Total partials:** 77

This plan groups every identified gap/partial into implementable initiatives,
prioritized by impact on platform parity and self-host/BYOC positioning.

## P0 — Core API parity: api (13 items)

### Model features & tool use (2 items)

**Actions:**
- Kimi K2.6 — thinking 参数 — *partial* — API area not explicitly covered; likely partial or missing.
- Kimi K2.7 Code 系列 — thinking 参数 — *partial* — API area not explicitly covered; likely partial or missing.

### Other (10 items)

**Actions:**
- 400 — 请求错误 — *partial* — Allternit returns HTTP/API errors but error-code taxonomy may differ.
- 401 — 认证错误 — *partial* — Allternit returns HTTP/API errors but error-code taxonomy may differ.
- 403 — 权限错误 — *partial* — Allternit returns HTTP/API errors but error-code taxonomy may differ.
- 404 — 资源不存在 — *partial* — Allternit returns HTTP/API errors but error-code taxonomy may differ.
- 429 — 速率限制 / 额度不足 — *partial* — Allternit returns HTTP/API errors but error-code taxonomy may differ.
- 499 / 500 / 503 / 504 — 连接与服务端错误 — *partial* — Allternit returns HTTP/API errors but error-code taxonomy may differ.
- API 概述 — *partial* — API area not explicitly covered; likely partial or missing.
- OpenAPI — *partial* — Workspace file/budget endpoints exist but not as a Kimi-shaped /v1/files or /v1/users/me/balance surface.
- SDK 安装 — *partial* — API area not explicitly covered; likely partial or missing.
- 取消批处理任务 — *partial* — API area not explicitly covered; likely partial or missing.

### Token estimation & usage (1 items)

**Actions:**
- 计算 Token — *gap* — No equivalent Kimi-style API surface found in Allternit.

## P3 — Release-notes/changelog (editorial): changelog (1 items)

### Other (1 items)

**Actions:**
- 平台新功能发布记录 — *gap* — Individual specs and ADRs exist in docs/, but no equivalent to Kimi's public changelog page.

## P2 — Docs surface parity: docs (1 items)

### Other (1 items)

**Actions:**
- 生成模型 Moonshot V1 — *partial* — Top-level docs/overview pages; Allternit has docs but not this exact structure.

## P1 — Developer-guide/UX parity: guide (73 items)

### Batch inference (2 items)

**Actions:**
- Batch 状态说明 — *gap* — No native Allternit batch inference API or guide surface.
- 使用 Batch API 批量处理任务 — *gap* — BatchToolbar is for restarting/stopping multiple swarm agents, not LLM batch jobs.

### Context caching (3 items)

**Actions:**
- 1M 上下文与自动缓存 — *gap* — No cache_control / context-caching feature exposed.
- Context Caching 与 RAG 怎么选 — *gap* — No cache_control / context-caching feature exposed.
- 使用 Kimi API 的 Context Caching 功能 — *gap* — Allternit models price fields for prompt caching but does not expose a context-caching feature.

### File API & purpose-driven uploads (5 items)

**Actions:**
- 上传文件还是base64 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 使用 Kimi API 进行文件问答 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 在这里，你需要将 kimi.mp4 文件替换为你想让 Kimi 识别的视频的地址 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 在这里，你需要将 kimi.png 文件替换为你想让 Kimi 识别的图片的地址 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 在这里，你需要将 video.mp4 文件替换为你想让 Kimi 识别的图片或视频的地址 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.

### Model features & tool use (23 items)

**Actions:**
- K2-Thinking 系列模型基准测试推荐参数 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- K3：用 `reasoning_effort` 调节推理强度 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- Q1: 为什么需要保留 `reasoning_content`？ — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 使用 Kimi API 完成工具调用（tool_calls） — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 使用 Kimi API 的 JSON Mode — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 使用 response_format 控制模型输出格式 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 保证每个 tool\_call 都有对应的 tool 消息 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 关于 reasoning\_content — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 在多轮对话中保留思考（Preserved Thinking） — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 处理流式输出中的 tool\_calls — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 开启 Thinking — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 我们使用标准库 base64.b64encode 函数将图片编码成 base64 格式的 image_url — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 我们使用标准库 base64.b64encode 函数将视频编码成 base64 格式的 video_url — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 排查 tool\_call\_id not found 错误 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 排查被截断的 JSON 输出 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 方式二：写入 settings.json（长期生效） — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 用 JSON Schema 定义工具 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 用 response\_format 启用 JSON Mode — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 用 thinking 参数控制 kimi-k2.6 的思考行为 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 用 tool\_calls 代替 function\_call — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 用动态加载实现 Tool Search — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 自定义工具与 `tool_choice` — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 调用 kimi-k2.7-code：无需传 thinking 参数 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.

### Other (35 items)

**Actions:**
- **填写 IP / CIDR 列表** — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- **配置 IP 白名单** — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- API 推荐参数与注意事项 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- Agentic 能力的提升 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- K2.5 模型基准测试推荐参数 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- K2.6 模型基准测试推荐参数 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- K3 API 配置 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- Show Case1：今日新闻报告 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- Show Case2：表格分析工具 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- Structured Output 的优势 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- `strict` 模式说明 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 不用 SDK 直接处理 SSE — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 准备 API Key — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 出现 429 错误 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 在 Chat Completions 中接入官方工具 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 处理 Fiber 执行结果并继续对话 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 多个回复（`n` 参数） — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 如何校验 schema 是否符合 MFJS — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 字段类型不匹配 / 输出 Markdown 代码块 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 安装 OpenAI SDK — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 安装 walle 工具 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 完整 Agent Loop — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 完整示例：调用 `web_search` 官方工具 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 强制模型调用工具：`"required"` — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 接入 Kimi API Platform — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 校验你的 schema — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 用 `name` 字段固定角色身份 — *gap* — No partial/best-of sampling mode in Allternit platform APIs.
- 用 messages 列表为模型补上记忆 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 由于 body 信息过于冗长，这里不再完整展示 body 详细内容 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 禁止工具调用：`"none"` — *gap* — No platform endpoint for estimating token usage/cost.
- 第三方工具：cc-switch — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 解析 SSE 响应体 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 让模型自行决定：`"auto"`（默认） — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 输出可能是 version = 1.10.0，表示 OpenAI SDK 已经安装成功，当前 python 实际使用了 openai 的 v1.10.0 的库 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 输出被截断（`finish_reason="length"`） — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.

### Partial mode / streaming deltas (2 items)

**Actions:**
- Partial Mode — *gap* — No partial/best-of sampling mode in Allternit platform APIs.
- 使用 Kimi API 的 Partial Mode — *gap* — Only found in gizzi-code SDK provider code, not exposed as a platform capability.

### Playground & debugging UI (2 items)

**Actions:**
- 使用 Playground 调试模型 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.
- 在 Playground 中配置 ModelScope MCP 服务器 — *partial* — Allternit has related building blocks but not this exact Kimi guide/feature.

### Token estimation & usage (1 items)

**Actions:**
- Q2: `reasoning_content` 会消耗额外的 token 吗？ — *gap* — No platform endpoint for estimating token usage/cost.

## P2 — Billing/pricing surface parity: pricing (1 items)

### Batch inference (1 items)

**Actions:**
- 批量推理定价 — *partial* — Pricing is provider/model-specific and recomputed server-side; no unified public pricing page was found.

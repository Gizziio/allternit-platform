# Kimi vs Allternit: Comprehensive 1-to-1 Gap Analysis

**Source:** Kimi API Platform docs (`platform.moonshot.cn/docs`) crawled and catalogued.
**Total Kimi capabilities mapped:** 159
- ✅ Present in Allternit: 4
- ⚠️ Partial match: 77
- ❌ Gap (missing): 12
- ➖ Not applicable: 66

## Method

1. Crawled Kimi docs via `/docs/llms.txt` and fetched every `.md` page.
2. Ran a Kimi k3 agent audit against the Allternit codebase.
3. Mapped each Kimi feature heading to the nearest audit finding. Unmatched headings received a conservative category heuristic.
4. Listed every gap and partial below, grouped by Kimi docs category.

## Gaps by category

## api (13 items)

⚠️ **400 — 请求错误**
   - Kimi page: [常见错误码说明](https://platform.kimi.com/docs/api/errors.md)
   - Description: | error type              | 典型 message                                                                            | 原因与处理                                   | | ----------------------- | --------------
   - Notes: Allternit returns HTTP/API errors but error-code taxonomy may differ.

⚠️ **401 — 认证错误**
   - Kimi page: [常见错误码说明](https://platform.kimi.com/docs/api/errors.md)
   - Description: | error type                     | 典型 message                 | 原因与处理                                                    | | ------------------------------ | -------------------------- | -------------
   - Notes: Allternit returns HTTP/API errors but error-code taxonomy may differ.

⚠️ **403 — 权限错误**
   - Kimi page: [常见错误码说明](https://platform.kimi.com/docs/api/errors.md)
   - Description: | error type                | 典型 message                                         | 原因与处理                             | | ------------------------- | -------------------------------------------------- 
   - Notes: Allternit returns HTTP/API errors but error-code taxonomy may differ.

⚠️ **404 — 资源不存在**
   - Kimi page: [常见错误码说明](https://platform.kimi.com/docs/api/errors.md)
   - Description: | error type                 | 典型 message                                 | 原因与处理 | | -------------------------- | ------------------------------------------ | ----- | | resourcenotfounderror | 模型不存在，
   - Notes: Allternit returns HTTP/API errors but error-code taxonomy may differ.

⚠️ **429 — 速率限制 / 额度不足**
   - Kimi page: [常见错误码说明](https://platform.kimi.com/docs/api/errors.md)
   - Description: | error type                     | 典型 message                                                 | 原因与处理                                                                                 | | --------------
   - Notes: Allternit returns HTTP/API errors but error-code taxonomy may differ.

⚠️ **499 / 500 / 503 / 504 — 连接与服务端错误**
   - Kimi page: [常见错误码说明](https://platform.kimi.com/docs/api/errors.md)
   - Description: | HTTP | error type                           | 原因与处理                                                           | | ---- | ------------------------------------ | --------------------------------------
   - Notes: Allternit returns HTTP/API errors but error-code taxonomy may differ.

⚠️ **API 概述**
   - Kimi page: [API 概述](https://platform.kimi.com/docs/api/overview.md)
   - Description: URL: https://platform.
   - Notes: API area not explicitly covered; likely partial or missing.

⚠️ **Kimi K2.6 — thinking 参数**
   - Kimi page: [模型参数参考](https://platform.kimi.com/docs/api/models-overview.md)
   - Description: Kimi K2.6 支持通过 thinking 参数控制是否启用深度思考。接受 {"type": "enabled"} 或 {"type": "disabled"}。  由于 OpenAI SDK 没有原生的 thinking 参数，需要使用 extrabody 传递：  <CodeGroup>   python Python theme={null}   completion = client.
   - Notes: API area not explicitly covered; likely partial or missing.

⚠️ **Kimi K2.7 Code 系列 — thinking 参数**
   - Kimi page: [模型参数参考](https://platform.kimi.com/docs/api/models-overview.md)
   - Description: kimi-k2.7-code 系列包含 kimi-k2.7-code 及其高速版 kimi-k2.7-code-highspeed，二者为同一模型、参数约束完全一致（含上方表格与 thinking 行为），仅输出速度不同，下文统称 kimi-k2.7-code。  kimi-k2.7-code 面向代码场景，除 thinking 外的参数约束与 kimi-k2.6 完全一致。与 kimi-k2.6
   - Notes: API area not explicitly covered; likely partial or missing.

⚠️ **OpenAPI**
   - Kimi page: [查询余额](https://platform.kimi.com/docs/api/balance.md)
   - Description: yaml GET /v1/users/me/balance openapi: 3.
   - Notes: Workspace file/budget endpoints exist but not as a Kimi-shaped /v1/files or /v1/users/me/balance surface.

⚠️ **SDK 安装**
   - Kimi page: [API 概述](https://platform.kimi.com/docs/api/overview.md)
   - Description: <CodeGroup>   bash Python theme={null}   pip install --upgrade 'openai>=1.
   - Notes: API area not explicitly covered; likely partial or missing.

⚠️ **取消批处理任务**
   - Kimi page: [取消批处理任务](https://platform.kimi.com/docs/api/batch-cancel.md)
   - Description: URL: https://platform.
   - Notes: API area not explicitly covered; likely partial or missing.

❌ **计算 Token**
   - Kimi page: [计算 Token](https://platform.kimi.com/docs/api/estimate.md)
   - Description: URL: https://platform.
   - Notes: No equivalent Kimi-style API surface found in Allternit.

## changelog (1 items)

❌ **平台新功能发布记录**
   - Kimi page: [平台新功能发布记录](https://platform.kimi.com/docs/changelog/changelog/changelog.md)
   - Description: URL: https://platform.
   - Allternit equivalent: No centralized platform changelog or research-notes publication.
   - Notes: Individual specs and ADRs exist in docs/, but no equivalent to Kimi's public changelog page.

## docs (1 items)

⚠️ **生成模型 Moonshot V1**
   - Kimi page: [模型列表](https://platform.kimi.com/docs/models.md)
   - Description: | 模型名称                              | 描述                                 | | --------------------------------- | ---------------------------------- | | moonshot-v1-8k                  | 适用于生成短文本，上下文长度
   - Notes: Top-level docs/overview pages; Allternit has docs but not this exact structure.

## guide (73 items)

⚠️ ****填写 IP / CIDR 列表****
   - Kimi page: [建立并认证你的组织](https://platform.kimi.com/docs/guide/org-best-practice.md)
   - Description: 点击【IP 白名单】后，在弹窗中的【IP / CIDR 列表】填写允许访问当前组织 API 的 IP 地址或 CIDR 网段。  <Frame>   <img src="https://mintcdn.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ ****配置 IP 白名单****
   - Kimi page: [建立并认证你的组织](https://platform.kimi.com/docs/guide/org-best-practice.md)
   - Description: IP 白名单是开放平台的组织级安全配置。个人认证和企业认证用户均可使用该能力；配置并保存后，仅白名单内的 IP 可以访问当前组织下的 API，不在白名单内的 IP 发起 API 请求时，将无法访问当前组织资源。  IP 白名单为空时，不限制 API 调用来源。保存 IP 白名单时，系统会使用当前填写的列表整体覆盖原有配置。
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

❌ **1M 上下文与自动缓存**
   - Kimi page: [Kimi K3](https://platform.kimi.com/docs/guide/kimi-k3-quickstart.md)
   - Description: <Note>   当前一个请求的 prompt tokens 大于 256 时，新的请求才能命中前缀缓存；当前一个请求的 prompt tokens 小于 256 时，请求不会被缓存而是被丢弃。详见  。 </Note>  上下文缓存对普通模型请求自动启用，无需 cache ID、TTL 或额外参数。保持长前缀不变，后续请求会自动尝试命中缓存。  python theme={null} from 
   - Notes: No cache_control / context-caching feature exposed.

⚠️ **API 推荐参数与注意事项**
   - Kimi page: [基准测试最佳实践](https://platform.kimi.com/docs/guide/benchmark-best-practice.md)
   - Description: 强烈推荐使用官方 API 来做 benchmark 测试，部分第三方 API 可能存在精度偏差  使用推荐的模型进行测试：    对于 K2.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **Agentic 能力的提升**
   - Kimi page: [Kimi K2.7 Code](https://platform.kimi.com/docs/guide/kimi-k2-7-code-quickstart.md)
   - Description: 在评估 Agent 自主化执行能力的 Kimi Claw 24/7 Bench、MCP Atlas 和 MCP Mark Verified 基准测试中，性能提升 10% 左右。  <img src="https://mintcdn.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

❌ **Batch 状态说明**
   - Kimi page: [使用 Batch API 批量处理任务](https://platform.kimi.com/docs/guide/use-batch-api.md)
   - Description: | 状态            | 说明                        | | ------------- | ------------------------- | | validating  | 已创建，正在校验输入数据              | | failed      | 数据校验失败，任务终止               | | inprogress | 数据校验通
   - Notes: No native Allternit batch inference API or guide surface.

❌ **Context Caching 与 RAG 怎么选**
   - Kimi page: [使用 Kimi API 的 Context Caching 功能](https://platform.kimi.com/docs/guide/use-context-caching-feature-of-kimi-api.md)
   - Description: 业界广泛采用 RAG（检索增强生成）方案进行长文本业务的降本。Context Caching 的降本幅度与业务特性高度相关，RAG 则与业务特性无关；两者的主要区别如下：  | 维度   | Context Caching            | RAG                                    | | ---- | -------------------------
   - Notes: No cache_control / context-caching feature exposed.

⚠️ **K2-Thinking 系列模型基准测试推荐参数**
   - Kimi page: [基准测试最佳实践](https://platform.kimi.com/docs/guide/benchmark-best-practice.md)
   - Description: <div style={{ overflowX: 'auto' }}>   <table style={{ minWidth: '800px' }}>     <thead>       <tr>         <th style={{ whiteSpace: 'nowrap' }}>Benchmark 分类</th>         <th style={{ whiteSpace: 'nowr
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **K2.5 模型基准测试推荐参数**
   - Kimi page: [基准测试最佳实践](https://platform.kimi.com/docs/guide/benchmark-best-practice.md)
   - Description: <div style={{ overflowX: 'auto' }}>   <table style={{ minWidth: '900px' }}>     <thead>       <tr>         <th style={{ whiteSpace: 'nowrap' }}>Benchmark 分类</th>         <th style={{ whiteSpace: 'nowr
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **K2.6 模型基准测试推荐参数**
   - Kimi page: [基准测试最佳实践](https://platform.kimi.com/docs/guide/benchmark-best-practice.md)
   - Description: <div style={{ overflowX: 'auto' }}>   <table style={{ minWidth: '900px' }}>     <thead>       <tr>         <th style={{ whiteSpace: 'nowrap' }}>Benchmark 分类</th>         <th style={{ whiteSpace: 'nowr
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **K3 API 配置**
   - Kimi page: [用 Kimi K3 搭建 Agent](https://platform.kimi.com/docs/guide/use-kimi-k3-to-setup-agent.md)
   - Description: 请使用 Python 3.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **K3：用 `reasoning_effort` 调节推理强度**
   - Kimi page: [思考模型](https://platform.kimi.com/docs/guide/use-thinking-models.md)
   - Description: kimi-k3 始终进行推理，不支持 thinking 参数。通过请求顶层 reasoningeffort 调节推理强度，支持 "low" / "high" / "max" 三档（默认 "max"），用法与示例见。  <span id="thinking-parameter" />
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

❌ **Partial Mode**
   - Kimi page: [Kimi K3](https://platform.kimi.com/docs/guide/kimi-k3-quickstart.md)
   - Description: 在消息末尾添加 partial=True 的 assistant message，让模型从指定文本前缀继续生成。最终展示时需要自行拼接前缀。  python theme={null} prefix: str = "结论：" completion = client.
   - Notes: No partial/best-of sampling mode in Allternit platform APIs.

⚠️ **Q1: 为什么需要保留 `reasoning_content`？**
   - Kimi page: [思考模型](https://platform.kimi.com/docs/guide/use-thinking-models.md)
   - Description: A: 保留 reasoningcontent 可以确保多步推理的连贯性，特别是在工具调用过程中。请把 API 返回的完整 assistant message 原样回传到 messages。对 K3，多轮对话和工具调用都必须这样处理；对 K2.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

❌ **Q2: `reasoning_content` 会消耗额外的 token 吗？**
   - Kimi page: [思考模型](https://platform.kimi.com/docs/guide/use-thinking-models.md)
   - Description: A: 是的，reasoningcontent 会计入输入/输出 token 消耗。具体计费方式请参考。
   - Notes: No platform endpoint for estimating token usage/cost.

⚠️ **Show Case1：今日新闻报告**
   - Kimi page: [使用 Playground 调试模型](https://platform.kimi.com/docs/guide/use-playground-to-debug-the-model.md)
   - Description: 场景说明：运用工具能力，请求模型搜索今日的新闻信息，并整理成 html 网页报告  工具选择：date 日期时间工具，web\search 工具，rethink 想法整理工具  说明：web\search 工具会调用 kimi 开放平台的联网搜索服务，单次联网搜索会进行计费，具体计费标准请见  点击页面 showcase 按钮，即可快速体验工具效果  <img src="https://mintc
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **Show Case2：表格分析工具**
   - Kimi page: [使用 Playground 调试模型](https://platform.kimi.com/docs/guide/use-playground-to-debug-the-model.md)
   - Description: 工具选择：excel 分析工具  <img src="https://mintcdn.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **Structured Output 的优势**
   - Kimi page: [使用 response_format 控制模型输出格式](https://platform.kimi.com/docs/guide/response_format.md)
   - Description: 与 JSON Mode 相比，Structured Output 的优势在于：   结构严格受控：模型输出必须完全遵循你定义的 JSON Schema，字段名、类型、嵌套层级都一一对应。  无需在 prompt 中反复描述格式：将格式要求从 schema 中剥离，降低 prompt 工程的复杂度。  下游系统对接更可靠：输出可直接被 json.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **`strict` 模式说明**
   - Kimi page: [使用 response_format 控制模型输出格式](https://platform.kimi.com/docs/guide/response_format.md)
   - Description: jsonschema.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **上传文件还是base64**
   - Kimi page: [Kimi K2.6](https://platform.kimi.com/docs/guide/kimi-k2-6-quickstart.md)
   - Description: 由于我们对请求体的整体大小有限制，所以对于非常大的视频，必须使用上传文件的方式使用视觉理解功能。对于需要多次引用的图片或视频，我们推荐使用文件上传的方式使用视觉理解功能。关于上传文件的限制，请参阅  文档。  图片数量限制：Vision 模型没有图片数量限制，但请确保请求的 Body 大小不超过 100M  URL 格式的图片：不支持，目前仅支持使用 base64 编码的图片内容
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **不用 SDK 直接处理 SSE**
   - Kimi page: [使用 Kimi API 的流式输出功能](https://platform.kimi.com/docs/guide/utilize-the-streaming-output-feature-of-kimi-api.md)
   - Description: 在没有 SDK 的语言环境，或 SDK 无法满足你的业务逻辑时，可以直接对接 HTTP 接口来处理流式输出。以下示例演示如何逐行读取并解析  响应体，详细说明见代码注释：  <Tabs>   <Tab title="python">     python theme={null}     import os     import json     import httpx  我们使用 httpx 
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

❌ **使用 Batch API 批量处理任务**
   - Kimi page: [使用 Batch API 批量处理任务](https://platform.kimi.com/docs/guide/use-batch-api.md)
   - Description: URL: https://platform.
   - Allternit equivalent: No native batch inference API; only swarm agent batch UI operations and OpenAI connector batch proxy.
   - Evidence: services/open-connector/src/providers/openai/actions.ts:504-520, surfaces/ai.allternit.com/src/views/swarm/components/BatchToolbar.tsx
   - Notes: BatchToolbar is for restarting/stopping multiple swarm agents, not LLM batch jobs.

⚠️ **使用 Kimi API 完成工具调用（tool_calls）**
   - Kimi page: [使用 Kimi API 完成工具调用（tool_calls）](https://platform.kimi.com/docs/guide/use-kimi-api-to-complete-tool-calls.md)
   - Description: URL: https://platform.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

❌ **使用 Kimi API 的 Context Caching 功能**
   - Kimi page: [使用 Kimi API 的 Context Caching 功能](https://platform.kimi.com/docs/guide/use-context-caching-feature-of-kimi-api.md)
   - Description: URL: https://platform.
   - Allternit equivalent: No cache_control or context-cache API. Pricing schema includes cache-read/write cost fields.
   - Evidence: surfaces/ai.allternit.com/src/lib/ai/ai-gateway-models-schemas.ts:33-34, surfaces/ai.allternit.com/src/lib/tokenlens/index.ts:39
   - Notes: Allternit models price fields for prompt caching but does not expose a context-caching feature.

⚠️ **使用 Kimi API 的 JSON Mode**
   - Kimi page: [使用 Kimi API 的 JSON Mode](https://platform.kimi.com/docs/guide/use-json-mode-feature-of-kimi-api.md)
   - Description: URL: https://platform.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

❌ **使用 Kimi API 的 Partial Mode**
   - Kimi page: [使用 Kimi API 的 Partial Mode](https://platform.kimi.com/docs/guide/use-partial-mode-feature-of-kimi-api.md)
   - Description: URL: https://platform.
   - Allternit equivalent: No partial/best-of/n-sampling mode in the platform chat/orchestration APIs.
   - Notes: Only found in gizzi-code SDK provider code, not exposed as a platform capability.

⚠️ **使用 Kimi API 进行文件问答**
   - Kimi page: [使用 Kimi API 进行文件问答](https://platform.kimi.com/docs/guide/use-kimi-api-for-file-based-qa.md)
   - Description: URL: https://platform.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **使用 Playground 调试模型**
   - Kimi page: [使用 Playground 调试模型](https://platform.kimi.com/docs/guide/use-playground-to-debug-the-model.md)
   - Description: URL: https://platform.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **使用 response_format 控制模型输出格式**
   - Kimi page: [使用 response_format 控制模型输出格式](https://platform.kimi.com/docs/guide/response_format.md)
   - Description: URL: https://platform.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **保证每个 tool\_call 都有对应的 tool 消息**
   - Kimi page: [使用 Kimi API 完成工具调用（tool_calls）](https://platform.kimi.com/docs/guide/use-kimi-api-to-complete-tool-calls.md)
   - Description: 工具调用场景下，消息不再是 system / user / assistant 的简单交替：   system: .
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **关于 reasoning\_content**
   - Kimi page: [使用 response_format 控制模型输出格式](https://platform.kimi.com/docs/guide/response_format.md)
   - Description: kimi-k3、kimi-k2.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **准备 API Key**
   - Kimi page: [在 Kimi Code CLI 中使用 Kimi API Platform](https://platform.kimi.com/docs/guide/kimi-code-cli.md)
   - Description: 打开 ，登录后进入  页面，创建并复制一个 API Key。  <Warning>   请妥善保管 API Key，不要与他人分享，也不要在截图中展示完整内容。 </Warning>
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **出现 429 错误**
   - Kimi page: [在 Hermes Agent 中使用 Kimi K3](https://platform.kimi.com/docs/guide/use-kimi-in-hermes-agent.md)
   - Description: 降低并发并稍后重试，同时检查账户余额和当前用户等级的调用限额。具体规则以  页面为准。
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **在 Chat Completions 中接入官方工具**
   - Kimi page: [如何在 Kimi API 中使用官方工具](https://platform.kimi.com/docs/guide/use-official-tools.md)
   - Description: 如  所示，在 Chat Completions 中使用官方工具时，需要让 Formula API 和模型对齐几个关键信息。
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **在 Playground 中配置 ModelScope MCP 服务器**
   - Kimi page: [在 Playground 中配置 ModelScope MCP 服务器](https://platform.kimi.com/docs/guide/configure-the-modelscope-mcp-server.md)
   - Description: URL: https://platform.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **在多轮对话中保留思考（Preserved Thinking）**
   - Kimi page: [思考模型](https://platform.kimi.com/docs/guide/use-thinking-models.md)
   - Description: 保留式思考指在多轮对话中，把历史轮次（previous turns）的 reasoningcontent 一并透传给模型，让模型在本轮推理时能延续之前的思考脉络。  对于 kimi-k2.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **在这里，你需要将 kimi.mp4 文件替换为你想让 Kimi 识别的视频的地址**
   - Kimi page: [Kimi K2.6](https://platform.kimi.com/docs/guide/kimi-k2-6-quickstart.md)
   - Description: videopath = "kimi.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **在这里，你需要将 kimi.png 文件替换为你想让 Kimi 识别的图片的地址**
   - Kimi page: [Kimi K2.6](https://platform.kimi.com/docs/guide/kimi-k2-6-quickstart.md)
   - Description: imagepath = "kimi.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **在这里，你需要将 video.mp4 文件替换为你想让 Kimi 识别的图片或视频的地址**
   - Kimi page: [配置 Kimi 视觉模型](https://platform.kimi.com/docs/guide/use-kimi-vision-model.md)
   - Description: videopath = "video.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **处理 Fiber 执行结果并继续对话**
   - Kimi page: [如何在 Kimi API 中使用官方工具](https://platform.kimi.com/docs/guide/use-official-tools.md)
   - Description: Fiber 是一次具体执行的“进程快照”，包含日志、Tracing、资源用量，方便调试与审计。POST 返回的 status 可能是 succeeded 或各种类型的错误；成功时结果类似：  json theme={null} {   "id": "fiber-f43p7sby7ny111houyq1",   "object": "fiber",   "createdat": 1753440997
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **处理流式输出中的 tool\_calls**
   - Kimi page: [使用 Kimi API 完成工具调用（tool_calls）](https://platform.kimi.com/docs/guide/use-kimi-api-to-complete-tool-calls.md)
   - Description: 流式输出模式（stream）下，toolcalls 同样适用，但有几点需要额外注意：   在流式输出的过程中，由于 finishreason 将会在最后的数据块中出现，因此建议使用 delta.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **多个回复（`n` 参数）**
   - Kimi page: [使用 Kimi API 的流式输出功能](https://platform.kimi.com/docs/guide/utilize-the-streaming-output-feature-of-kimi-api.md)
   - Description: <Note>   当前模型（kimi-k3、kimi-k2.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **如何校验 schema 是否符合 MFJS**
   - Kimi page: [使用 response_format 控制模型输出格式](https://platform.kimi.com/docs/guide/response_format.md)
   - Description: 可以使用 walle CLI 工具快速自检 schema 的兼容性：  bash theme={null}
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **字段类型不匹配 / 输出 Markdown 代码块**
   - Kimi page: [使用 response_format 控制模型输出格式](https://platform.kimi.com/docs/guide/response_format.md)
   - Description: 在 kimi-k2.6 等旧模型上，可能出现以下情况：   返回的 content 包含 Markdown 代码块（如 json ... ），导致 json.loads 失败。  oneOf / $ref 等复杂 schema 未被严格遵守。  建议：   使用 kimi-k2.7-code 进行 Structured Output 调用。  如果必须使用 kimi-k2.6，在业务层先 stri
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **安装 OpenAI SDK**
   - Kimi page: [Kimi K2.6](https://platform.kimi.com/docs/guide/kimi-k2-6-quickstart.md)
   - Description: Kimi API 完全兼容 OpenAI 的 API 格式，你可以通过如下方式来安装 OpenAI SDK：  bash theme={null} pip install --upgrade 'openai>=1.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **安装 walle 工具**
   - Kimi page: [使用 response_format 控制模型输出格式](https://platform.kimi.com/docs/guide/response_format.md)
   - Description: go install github.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **完整 Agent Loop**
   - Kimi page: [用 Kimi K3 搭建 Agent](https://platform.kimi.com/docs/guide/use-kimi-k3-to-setup-agent.md)
   - Description: 将下面代码保存为 agent.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **完整示例：调用 `web_search` 官方工具**
   - Kimi page: [如何在 Kimi API 中使用官方工具](https://platform.kimi.com/docs/guide/use-official-tools.md)
   - Description: 以下 Python 示例以 web-search 官方工具为例，演示完整调用链路（仅依赖 requests）。你也可以前往  交互式体验 Kimi 模型和工具的能力。  通过 Formula API 使用官方工具遵循 OpenAI 协议的标准 function tool 流程，共 4 步：  1.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **开启 Thinking**
   - Kimi page: [在 Claude Code 中使用 Kimi](https://platform.kimi.com/docs/guide/claude-code-kimi.md)
   - Description: kimi-k3 默认开启思考，开箱即用。如果你切换为 kimi-k2.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **强制模型调用工具：`"required"`**
   - Kimi page: [工具调用约束](https://platform.kimi.com/docs/guide/use-tool-choice.md)
   - Description: 当工作流必须走工具链路时使用——例如强制检索、强制查询数据库，不允许模型凭记忆直接作答：  json theme={null} {   "toolchoice": "required" }   模型在本轮必须至少调用一个工具。使用时请确保请求中声明了可调用的工具。一个典型用法是工具搜索模式：首轮用 "required" 强制模型调用 searchtools，检索完成后恢复 "auto"，详见 。
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **我们使用标准库 base64.b64encode 函数将图片编码成 base64 格式的 image_url**
   - Kimi page: [Kimi K2.6](https://platform.kimi.com/docs/guide/kimi-k2-6-quickstart.md)
   - Description: imageurl = f"data:image/{os.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **我们使用标准库 base64.b64encode 函数将视频编码成 base64 格式的 video_url**
   - Kimi page: [Kimi K2.6](https://platform.kimi.com/docs/guide/kimi-k2-6-quickstart.md)
   - Description: videourl = f"data:video/{os.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **排查 tool\_call\_id not found 错误**
   - Kimi page: [使用 Kimi API 完成工具调用（tool_calls）](https://platform.kimi.com/docs/guide/use-kimi-api-to-complete-tool-calls.md)
   - Description: 如果你遇到 toolcallid not found 错误，可能是由于你未将 Kimi API 返回的 role=assistant 消息添加到 messages 列表中，正确的消息序列应该看起来像这样：   system: .
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **排查被截断的 JSON 输出**
   - Kimi page: [使用 Kimi API 的 JSON Mode](https://platform.kimi.com/docs/guide/use-json-mode-feature-of-kimi-api.md)
   - Description: 如果正确设置了 responseformat 参数、也在提示词 prompt 中指定了 JSON 文档的格式，但获取的 JSON 文档不完整或被截断、导致无法正确解析，请检查返回值中的 finishreason 字段是否为 length。  较小的 maxtokens 值会导致模型输出内容被截断，使用 JSON Mode 时同样适用这个规则。建议在预估输出的 JSON 文档大小后，设置一个合理的 
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **接入 Kimi API Platform**
   - Kimi page: [在 Kimi Code CLI 中使用 Kimi API Platform](https://platform.kimi.com/docs/guide/kimi-code-cli.md)
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **方式二：写入 settings.json（长期生效）**
   - Kimi page: [在 Claude Code 中使用 Kimi](https://platform.kimi.com/docs/guide/claude-code-kimi.md)
   - Description: 将同样的变量写入 ~/.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **校验你的 schema**
   - Kimi page: [使用 response_format 控制模型输出格式](https://platform.kimi.com/docs/guide/response_format.md)
   - Description: walle -schema 'yourschemajson' -level strict   > 即使 schema 包含 anyOf / oneOf / $ref，API 也常能正常返回 200，且响应中不会出现 warning 字段。因此 walle 更适合作为静态检查入口，实际兼容性请以目标模型的在线调用结果为准。
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **用 JSON Schema 定义工具**
   - Kimi page: [使用 Kimi API 完成工具调用（tool_calls）](https://platform.kimi.com/docs/guide/use-kimi-api-to-complete-tool-calls.md)
   - Description: 人在网上查资料时，通常先打开搜索引擎（例如百度或必应）搜索内容、浏览搜索结果，再打开一个或多个结果网页获取需要的知识。把这两个动作抽象成工具，就是“搜索引擎”和“网页浏览器”——用 JSON Schema 描述后提交给 Kimi 大模型，它就能和人一样搜索并浏览网页。  工具定义使用 JSON Schema 格式编写：  >  is a vocabulary that you can use to
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

❌ **用 `name` 字段固定角色身份**
   - Kimi page: [使用 Kimi API 的 Partial Mode](https://platform.kimi.com/docs/guide/use-partial-mode-feature-of-kimi-api.md)
   - Description: name 是 Partial Mode 中的一个特殊字段，作用是强化模型对角色的认知，强制模型以 name 指定的角色的口吻输出内容。name 字段是输出内容前缀的一部分。以下示例使用 Kimi 大模型进行角色扮演，以《明日方舟》中的凯尔希医生为例：通过设置 "name": "凯尔希"，让 Kimi 大模型以凯尔希作为自己的角色进行输出，更好地保持角色的一致性：  <Tabs>   <Tab ti
   - Notes: No partial/best-of sampling mode in Allternit platform APIs.

⚠️ **用 messages 列表为模型补上记忆**
   - Kimi page: [配置多轮对话参数](https://platform.kimi.com/docs/guide/engage-in-multi-turn-conversations-using-kimi-api.md)
   - Description: 以下示例改造自上一章节，演示如何通过维护 messages 列表让模型拥有记忆：每轮对话把用户的新消息（role=user）和模型的回复（role=assistant）都追加到列表中，再整体随请求发送。实现要点已以注释形式标注在代码中：  <Tabs>   <Tab title="python">     python theme={null}     import os     from ope
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **用 response\_format 启用 JSON Mode**
   - Kimi page: [使用 Kimi API 的 JSON Mode](https://platform.kimi.com/docs/guide/use-json-mode-feature-of-kimi-api.md)
   - Description: 如果只在提示词 prompt 中告诉 Kimi 大模型："请输出 JSON 格式的内容"，Kimi 大模型能理解你的诉求，也会按要求生成 JSON 文档，但生成的内容通常会有一些瑕疵：例如在 JSON 文档之外，Kimi 还会额外输出其他文字内容对 JSON 文档进行解释——  text theme={null} 以下是你需要的 JSON 文档  { 	"title": "文章标题", 	"aut
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **用 thinking 参数控制 kimi-k2.6 的思考行为**
   - Kimi page: [思考模型](https://platform.kimi.com/docs/guide/use-thinking-models.md)
   - Description: kimi-k2.6 通过 thinking 参数控制思考行为，包含两个子字段：   thinking.type："enabled"（默认）| "disabled"，控制是否开启思考。由于默认即为 "enabled"，上面的示例无需显式传入即可思考；禁用示例见 。  thinking.keep：null（默认，忽略历史轮次的思考）| "all"（保留历史轮次的 reasoningcontent，启用
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **用 tool\_calls 代替 function\_call**
   - Kimi page: [使用 Kimi API 完成工具调用（tool_calls）](https://platform.kimi.com/docs/guide/use-kimi-api-to-complete-tool-calls.md)
   - Description: toolcalls 由函数调用（functioncall）进化而来，functioncall 是 toolcalls 的子集——在某些特定语境下，或阅读兼容性代码时，可以将两者划等号。由于 OpenAI 已将 functioncall 等参数（例如 functions）标记为“已废弃”，我们的 API 将不再支持 functioncall，请用 toolcalls 代替。相比 functionca
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **用动态加载实现 Tool Search**
   - Kimi page: [动态加载工具](https://platform.kimi.com/docs/guide/use-dynamic-tool-loading.md)
   - Description: API 层面没有专门的 tool search 接口。如果你的工具数量很多，可以组合「自定义 search 工具 + 动态加载工具」来自行实现 tool search：  1.
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **由于 body 信息过于冗长，这里不再完整展示 body 详细内容**
   - Kimi page: [MoonPalace - Moonshot AI 月之暗面 Kimi API 调试工具](https://platform.kimi.com/docs/guide/use-moonpalace.md)
   - Description: +--------------------------------------------------+--------------------------------------------------+ | requestbody                                     | responsebody                                
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

❌ **禁止工具调用：`"none"`**
   - Kimi page: [工具调用约束](https://platform.kimi.com/docs/guide/use-tool-choice.md)
   - Description: 当请求只需要纯文本回复、不希望模型误触发工具时使用：  json theme={null} {   "toolchoice": "none" }   模型会直接输出文本，不产生任何 toolcalls，同时降低延迟与 token 消耗。
   - Notes: No platform endpoint for estimating token usage/cost.

⚠️ **第三方工具：cc-switch**
   - Kimi page: [在 Claude Code 中使用 Kimi](https://platform.kimi.com/docs/guide/claude-code-kimi.md)
   - Description: cc-switch 等社区工具可以在多套供应商配置之间切换。这类工具并非 Kimi 官方维护，其预设配置可能与本页推荐值存在差异，使用后请对照「配置项说明」逐一核对各变量取值，并用 /status 确认实际生效的 Base URL 与模型。
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **自定义工具与 `tool_choice`**
   - Kimi page: [Kimi K3](https://platform.kimi.com/docs/guide/kimi-k3-quickstart.md)
   - Description: 首轮用 toolchoice="required" 强制至少调用一个工具。执行每个调用后，回传完整 assistant message，并用对应的 toolcallid 逐条追加工具结果。  <Accordion title="最小天气 Agent Loop">   python theme={null}   import json   from typing import Any    tool
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **解析 SSE 响应体**
   - Kimi page: [使用 Kimi API 的流式输出功能](https://platform.kimi.com/docs/guide/utilize-the-streaming-output-feature-of-kimi-api.md)
   - Description: 开启流式输出后，接口不再返回 JSON 格式的响应（Content-Type: application/json），而是返回 Content-Type: text/event-stream（SSE），服务端得以源源不断地向客户端传输 Tokens。 的响应体如下所示：  text theme={null} data: {"id":"cmpl-1305b94c570f447fbde318056073
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **让模型自行决定：`"auto"`（默认）**
   - Kimi page: [工具调用约束](https://platform.kimi.com/docs/guide/use-tool-choice.md)
   - Description: 不传入 toolchoice 时即为 "auto"：模型根据上下文自行决定是否调用工具，适合常规对话。
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **调用 kimi-k2.7-code：无需传 thinking 参数**
   - Kimi page: [思考模型](https://platform.kimi.com/docs/guide/use-thinking-models.md)
   - Description: kimi-k2.7-code 是面向代码场景的思考模型，与 kimi-k2.6 共享同一套思考机制（reasoningcontent、多步工具调用、流式输出等），差异仅在 thinking 参数（见上方对照表）。使用时无需（也不应）传入 thinking 参数，只需切换 model 即可，模型始终输出 reasoningcontent。由于保留式思考始终开启，多轮对话中请务必把每一轮历史 assi
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **输出可能是 version = 1.10.0，表示 OpenAI SDK 已经安装成功，当前 python 实际使用了 openai 的 v1.10.0 的库**
   - Kimi page: [Kimi K2.6](https://platform.kimi.com/docs/guide/kimi-k2-6-quickstart.md)
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

⚠️ **输出被截断（`finish_reason="length"`）**
   - Kimi page: [使用 response_format 控制模型输出格式](https://platform.kimi.com/docs/guide/response_format.md)
   - Description: 模型在输出完整 JSON 之前达到了 maxtokens 限制。建议：   增大 maxtokens（例如 4096 或更高）  简化 schema 的嵌套层级  缩短输入文本长度
   - Notes: Allternit has related building blocks but not this exact Kimi guide/feature.

## pricing (1 items)

⚠️ **批量推理定价**
   - Kimi page: [批量推理定价](https://platform.kimi.com/docs/pricing/batch.md)
   - Description: URL: https://platform.
   - Allternit equivalent: Per-model cost fields and server-side pricing recompute are stored in usage events.
   - Evidence: cmd/allternit-api/src/llm_gateway/llm_pricing.rs:21-40, cmd/allternit-api/src/llm_gateway/proxy.rs:160-168, surfaces/ai.allternit.com/src/lib/ai/models.generated.ts
   - Notes: Pricing is provider/model-specific and recomputed server-side; no unified public pricing page was found.

## Present capabilities summary

### api
- ✅ 兼容 OpenAI

### docs
- ✅ 文本与多模态模型

### guide
- ✅ 与 Kimi 其他产品对比
- ✅ 自动断线重连

## Not applicable summary

➖ **agreement**: Kimi 开放平台服务协议
➖ **agreement**: 一、账号使用说明
➖ **changelog**: 2024年11月4日
➖ **changelog**: 2024年12月2日
➖ **changelog**: 2024年4月30日
➖ **changelog**: 2024年5月29日
➖ **changelog**: 2024年6月28日
➖ **changelog**: 2024年7月10日
➖ **changelog**: 2024年7月1日
➖ **changelog**: 2024年7月31日
➖ **changelog**: 2024年8月28日
➖ **changelog**: 2024年9月30日
➖ **changelog**: 2025年1月13日
➖ **changelog**: 2025年2月17日
➖ **changelog**: 2025年4月7日
➖ **changelog**: MoBA：面向长文本大模型的混合块注意力机制
➖ **changelog**: Muon 优化器的首次大规模训练实践
➖ **changelog**: train qwen-like dense model with adamw
➖ **changelog**: train qwen-like dense model with muon
➖ **changelog**: 从全注意力（Full Attention）到混合块注意力（MoBA）
➖ **changelog**: 将 MoBA 扩展到1000万上下文
➖ **changelog**: 用Hugging Face Transformers进行推理
➖ **guide**: 3 万亿级开源模型
➖ **guide**: 401 / Invalid Authentication
➖ **guide**: Hermes 连接到了错误的 Endpoint
➖ **guide**: Kimi K2.6
➖ **guide**: Kimi K2.7 Code
➖ **guide**: Kimi K3
➖ **guide**: Kimi K3 API 工具调用最佳实践
➖ **guide**: MoonPalace - Moonshot AI 月之暗面 Kimi API 调试工具
➖ **guide**: Prompt 最佳实践
➖ **guide**: Tokens 计算及费用
➖ **guide**: Tool Use 参数兼容性
➖ **guide**: id/chatcmpl/requestid 选项只需要任选其一即可检索出对应的请求
➖ **guide**: search 工具的具体实现，这里我们只需要返回参数即可
➖ **guide**: 从 Releases 页面下载
➖ **guide**: 估算 token 消耗与费用
➖ **guide**: 使用 `go` 命令安装
➖ **guide**: 切换到 Kimi API Platform API Key
➖ **guide**: 同步魔搭托管的 MCP 服务
➖ **guide**: 在 Claude Code 中使用 Kimi
➖ **guide**: 在 Codex CLI 中使用 Kimi K3
➖ **guide**: 在 Hermes Agent 中使用 Kimi K3
➖ **guide**: 在 Kimi Code CLI 中使用 Kimi API Platform
➖ **guide**: 在 OpenClaw 中连接 Kimi
➖ **guide**: 在 OpenCode 中使用 Kimi 模型
➖ **guide**: 安装 Claude Code
➖ **guide**: 定义要使用的官方工具 Formula URI
➖ **guide**: 找不到 Moonshot 认证选项
➖ **guide**: 无法执行 `/login`
➖ **guide**: 理解 Formula 概念
➖ **guide**: 用 Kimi K3 搭建 Agent
➖ **guide**: 用文件 ID 引用已上传的图片或视频
➖ **guide**: 第一步：开启 Codex 路由
➖ **guide**: 第一步：选择中国区 Kimi Provider 和 K3
➖ **guide**: 第二步：写入 K3 完整配置
➖ **guide**: 第二步：添加 Kimi Provider
➖ **guide**: 第四步：启动 Codex CLI
➖ **guide**: 第四步：启动 Hermes 并使用 K3
➖ **guide**: 获取 Kimi API Key
➖ **guide**: 获取工具定义并追加到 `tools` 字段
➖ **pricing**: Kimi K2.6 模型定价
➖ **pricing**: 多模态模型 Kimi K2.5 定价
➖ **pricing**: 旗舰模型 Kimi K3 定价
➖ **pricing**: 生成模型 Moonshot V1 定价
➖ **pricing**: 编程模型 Kimi K2.7 Code 定价

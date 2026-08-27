# OpenAI → Allternit Gap Implementation Plan

**Generated from:** /Users/joe/Desktop/openai-docs/openai_allternit_gap_analysis.md
**Total gaps:** 1533 | **Total partials:** 2498

This plan groups every identified gap/partial into implementable initiatives,
prioritized by impact on platform parity and self-host/BYOC positioning.

## P2: ads (2 items)

### Other (2 items)

**Actions:**
- Examples — *partial* — Cookbook is OpenAI's example corpus, not a product capability; Allternit has internal docs and a course pipeline but no 
- OpenAPI spec — *partial* — No spec-driven public API documentation for the main control plane.

## P0 — Core model-serving API parity: api (74 items)

### Agent Surfaces (2 items)

**Actions:**
- Build agents — *partial* — API area not explicitly covered by Allternit audit; likely partial or missing.
- Key ideas and best practices — *gap* — No equivalent hosted OpenAI-style endpoint found in Allternit.

### Batch & Files (2 items)

**Actions:**
- File input — *partial* — API area not explicitly covered by Allternit audit; likely partial or missing.
- Uploading test data — *gap* — No equivalent hosted OpenAI-style endpoint found in Allternit.

### Embeddings & RAG (2 items)

**Actions:**
- File search — *partial* — Semantic recall exists but no vector-store CRUD resources and no file-search tool over managed stores; vector index is i
- Tool search — *partial* — Semantic recall exists but no vector-store CRUD resources and no file-search tool over managed stores; vector index is i

### Image & Vision (15 items)

**Actions:**
- Analyze images and files — *gap* — No equivalent hosted OpenAI-style endpoint found in Allternit.
- Create a new image using image references — *gap* — No equivalent hosted OpenAI-style endpoint found in Allternit.
- Customize Image Output — *partial* — API area not explicitly covered by Allternit audit; likely partial or missing.
- Edit Images — *gap* — No equivalent hosted OpenAI-style endpoint found in Allternit.
- Edit an image using a mask — *partial* — API area not explicitly covered by Allternit audit; likely partial or missing.
- Generate Images — *gap* — No equivalent hosted OpenAI-style endpoint found in Allternit.
- Image API — *partial* — No purpose/expiration semantics; files are workspace artifacts, not LLM-context resources.
- Image generation — *partial* — API area not explicitly covered by Allternit audit; likely partial or missing.
- Image input — *partial* — Real multimodal use exists in the computer-use pipeline, but the served chat API substitutes '[image_url]' placeholders 
- Image input fidelity — *gap* — No equivalent hosted OpenAI-style endpoint found in Allternit.
- Models prior to `gpt-image-2` — *partial* — Real multimodal use exists in the computer-use pipeline, but the served chat API substitutes '[image_url]' placeholders 
- Multi-turn image generation — *gap* — No equivalent hosted OpenAI-style endpoint found in Allternit.
- Partial images cost — *gap* — No equivalent hosted OpenAI-style endpoint found in Allternit.
- Save the image to a file — *partial* — Real multimodal use exists in the computer-use pipeline, but the served chat API substitutes '[image_url]' placeholders 
- `gpt-image-2` output tokens — *partial* — API area not explicitly covered by Allternit audit; likely partial or missing.

### Other (47 items)

**Actions:**
- Add credits to keep building — *partial* — API area not explicitly covered by Allternit audit; likely partial or missing.
- Additional configurations — *partial* — API area not explicitly covered by Allternit audit; likely partial or missing.
- Analyze the results — *partial* — API area not explicitly covered by Allternit audit; likely partial or missing.
- Best practices for defining functions — *partial* — API area not explicitly covered by Allternit audit; likely partial or missing.
- Body Parameters — *partial* — API area not explicitly covered by Allternit audit; likely partial or missing.
- Calculating costs — *gap* — No equivalent hosted OpenAI-style endpoint found in Allternit.
- Choosing the right API — *partial* — API area not explicitly covered by Allternit audit; likely partial or missing.
- Connecting using an ephemeral token — *partial* — API area not explicitly covered by Allternit audit; likely partial or missing.
- Connecting using the unified interface — *partial* — API area not explicitly covered by Allternit audit; likely partial or missing.
- Context-free grammars — *partial* — API area not explicitly covered by Allternit audit; likely partial or missing.
- Correct versus incorrect patterns — *partial* — API area not explicitly covered by Allternit audit; likely partial or missing.
- Cost and latency — *partial* — API area not explicitly covered by Allternit audit; likely partial or missing.
- Create a model response — *gap* — No equivalent hosted OpenAI-style endpoint found in Allternit.
- Create a running input list we will add to over time — *partial* — API area not explicitly covered by Allternit audit; likely partial or missing.
- Create and export an API key — *partial* — API area not explicitly covered by Allternit audit; likely partial or missing.
- Custom tools — *partial* — API area not explicitly covered by Allternit audit; likely partial or missing.
- Defining functions — *partial* — API area not explicitly covered by Allternit audit; likely partial or missing.
- Defining namespaces — *partial* — API area not explicitly covered by Allternit audit; likely partial or missing.
- Developer quickstart — *partial* — API area not explicitly covered by Allternit audit; likely partial or missing.
- Example — *partial* — Cookbook is OpenAI's example corpus, not a product capability; Allternit has internal docs and a course pipeline but no 
- ... and 27 more items in this bucket

### Safety & Compliance (1 items)

**Actions:**
- Content Moderation — *gap* — No equivalent hosted OpenAI-style endpoint found in Allternit.

### Training & Evaluation (4 items)

**Actions:**
- Create an eval for a task — *partial* — API area not explicitly covered by Allternit audit; likely partial or missing.
- Creating an eval run — *partial* — API area not explicitly covered by Allternit audit; likely partial or missing.
- Test a prompt with your eval — *partial* — API area not explicitly covered by Allternit audit; likely partial or missing.
- Working with evals — *partial* — Benchmark scores influence routing but there is no user-defined eval/grader CRUD; self-improve module explicitly states 

### Voice & Realtime (1 items)

**Actions:**
- Realtime API with WebRTC — *partial* — No bidirectional realtime audio session layer, no ephemeral client secrets; Rust streaming routes are stubs ('return the

## P2: blog (4 items)

### Image & Vision (1 items)

**Actions:**
- Images — *partial* — Thin proxy to third-party providers via runtime credentials; no self-hosted image model serving.

### Other (2 items)

**Actions:**
- Models — *partial* — Real multimodal use exists in the computer-use pipeline, but the served chat API substitutes '[image_url]' placeholders 
- Tracing — *partial* — Agent-building capability exists but is not packaged as a standalone public SDK with a tracing UI.

### Voice & Realtime (1 items)

**Actions:**
- Speech-to-speech — *partial* — No bidirectional realtime audio session layer, no ephemeral client secrets; Rust streaming routes are stubs ('return the

## P1 — ChatGPT/Codex user-facing surface parity: chatgpt-codex (1535 items)

### Agent Surfaces (203 items)

**Actions:**
- --- Example: Azure/OpenAI-compatible provider --- — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- --- Example: OpenAI data residency with explicit base URL or headers --- — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- --- Example: built-in Amazon Bedrock provider options --- — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- .worktreeinclude — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- AGENTS Guidance — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Additional considerations — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Agent approvals & security — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Agent internet access — *partial* — Policy-as-code with hash-locked injection exists; no admin-pushed user-unoverridable settings channel like requirements.
- Allow outbound network access inside the sandbox. Default: false — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Amazon Bedrock provider — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Ask about a YouTube video — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Build a single-agent workflow — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- By extending the :workspace profile, you get Codex's safeguards to ensure — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- CLI command reference — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- CLI customization — *partial* — TUI is rich but explicit theme/shell-completion/prompt-editor docs equivalents were not identified.
- CLI, IDE, App, and Cloud Behavior — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- ChatGPT customers using data residency — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Clickable citations — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Code doesn't run on a worktree — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Codex GitHub Action — *partial* — No first-party VS Code/JetBrains extension found; integration is protocol-level (ACP) plus deep links.
- ... and 183 more items in this bucket

### Batch & Files (45 items)

**Actions:**
- Add custom file handlers — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Are prompts, outputs, files, actions, or tool calls logged? — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Attach files — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- By default, deny read access to all files on disk. — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- By extending the :workspace profile, :tmpdir and :slash_tmp are "write" by — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Common profiles — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Config Profiles (separate files) — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Control available permission profiles — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Create a rules file — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Create files for review — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Customize fallback filenames — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Define and select a profile — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Environment Profile — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Example additional workspace roots that inherit this profile's — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Example filesystem profile. Use `"deny"` to deny reads for exact paths or — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Experimental: run via user shell profile. Default: false — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Extend a profile — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- File access limited to workspace — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- File change approvals — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Filesystem permissions — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- ... and 25 more items in this bucket

### Embeddings & RAG (28 items)

**Actions:**
- Apply repository guidance and coverage consistently — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Collaborate in a dedicated academic research workspace — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Communication style for supported models. Allowed values: none | friendly | pragmatic — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Configure local web search — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Credential storage — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Findings and coverage — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Fuzzy file search events (experimental) — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- If you use --yolo or another full access sandbox setting, web search defaults to live. — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Local memory storage — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Max bytes from AGENTS.md to embed into first-turn instructions. Default: 32768 — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Project root marker filenames used when searching parent directories. Default: [".git"] — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Research a decision — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Research, analyze, and create in your browser — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Search from the address bar — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Search past chats and find in a chat — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Tool coverage — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Web search mode: disabled | cached | indexed | live. Default: "cached" — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- What does incomplete coverage mean — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- cached serves results from a web search cache (an OpenAI-maintained index). — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- disable_on_external_context = false # legacy alias: no_memories_if_mcp_or_web_search — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- ... and 8 more items in this bucket

### Image & Vision (15 items)

**Actions:**
- Add text to an image — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Default universal image — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Generate or edit an image — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Groups and provisioning — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- How does image generation count toward usage limits? — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Image generation — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Image inputs — *partial* — Real multimodal use exists in the computer-use pipeline, but the served chat API substitutes '[image_url]' placeholders 
- Refine generated images in your conversation — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Review and edit generated images — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Use multiple reference images — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Use the right image feature — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Write effective image prompts — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Write the prompt around the image — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- tools_view_image = true — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- view_image = true — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.

### Other (1160 items)

**Actions:**
- "/absolute/path/to/secrets" = "deny" — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- "/var/run/docker.sock" = "allow" — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- ":workspace_roots" = { "." = "write", "\*\*/\*.env" = "deny" } — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- "\*" allows any public host that is not denied, so prefer scoped rules when possible. — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- "\*.example.com" matches subdomains only; "\*\*.example.com" matches the apex plus subdomains. — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- "api.openai.com" = "allow" — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- "example.com" = "deny" — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- "x-otlp-api-key" = "${OTLP_TOKEN}" — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- "~/code/app" = true — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- "~/code/shared-lib" = true — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- --- Example: Local OSS (e.g., Ollama-compatible) --- — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- --- Example: STDIO transport --- — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- --- Example: Streamable HTTP transport --- — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- --- Example: command-backed bearer token auth --- — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- 0.1.10 (June 23, 2026) — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- 0.1.11 (July 10, 2026) — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- 0.1.12 (July 23, 2026) — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- 0.1.13 (July 25, 2026) — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- 0.1.14 (July 28, 2026) — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- 0.1.15 (July 30, 2026) — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- ... and 1140 more items in this bucket

### Plugins & Marketplace (73 items)

**Actions:**
- Add plugins for more context and better outputs — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Brainstorm plugin use cases — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Browse plugins with `/plugins` — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Build plugins — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Build your own plugin — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Choose a starting set of plugins — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Choose between a skill and a plugin — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Codex Security plugin changelog — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Codex Security plugin quickstart — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Connect Linear for local work (MCP) — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Connect and test your plugin — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Connect tools with plugins — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Control plugin availability — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Control whether users can submit feedback from `/feedback`. Default: true — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Create a plugin with `@plugin-creator` — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Create a skills-only plugin manually — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Custom callback paths are supported. `mcp_oauth_callback_port` still controls the listener port. — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Customization, Skills, Rules, MCP, and Integrations — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Define MCP servers under this table. Leave empty to disable. — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Docs MCP — *partial* — Allternit has a real learning platform for its own codebase; no public docs-MCP server for external developers.
- ... and 53 more items in this bucket

### Safety & Compliance (9 items)

**Actions:**
- Compliance — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Compliance API — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Compliance API and audit events — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Cyber Safety — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Flag combinations and safety tips — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Permissions and safety — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Safety guidance — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Show raw reasoning content when available. Default: false — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- When to use the Compliance API — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.

### Voice & Realtime (2 items)

**Actions:**
- ChatGPT Voice — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.
- Talk through work with ChatGPT Voice — *gap* — Specific ChatGPT/Codex surface feature not found in Allternit.

## P2 — Codex landing/docs parity: codex (4 items)

### Agent Surfaces (1 items)

**Actions:**
- CLI customization — *partial* — TUI is rich but explicit theme/shell-completion/prompt-editor docs equivalents were not identified.

### Other (3 items)

**Actions:**
- Prompt editor — *partial* — TUI is rich but explicit theme/shell-completion/prompt-editor docs equivalents were not identified.
- Shell completions — *partial* — TUI is rich but explicit theme/shell-completion/prompt-editor docs equivalents were not identified.
- Syntax highlighting and themes — *partial* — TUI is rich but explicit theme/shell-completion/prompt-editor docs equivalents were not identified.

## P2: commerce (1 items)

### Other (1 items)

**Actions:**
- Webhooks — *partial* — No user-configurable outbound webhook subscriptions; webhook_secret field is a None stub. Events otherwise surface via S

## P2 — Example/pattern library expansion: cookbook (2126 items)

### Agent Surfaces (213 items)

**Actions:**
- **Codex** Prompting Guide — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- **Guide to Direct Preference Optimization** — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- **Step 6 – Check claims against evidence (true / false / uncertain)** — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 1.2 Ask Codex to create the pilot ExecPlan — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 1.3 Configure Bedrock Credentials and Clients — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 2.1 Ask Codex to draft the overview — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 2.2.  **Ideation (`o4-mini` + Tools):** — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 3.1. Introducing our Temporal Agent — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 3.1.2. The Temporal Agent Pipeline — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 3.1.3. Selecting the right model for a Temporal Agent — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 3.2. Building our Temporal Agent Pipeline — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 3.2.10. Invalidation agent — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 3.2.3. Laying the Foundations for our Temporal Agent — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 3.2.8. Defining our Temporal Agent — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 3.4.1. Temporal Agent — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 3.4.2. Invalidation Agent — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 4.1.2. (Re-)Initialise OpenAI Client — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 4.3 Keep Tools and Schemas Identical — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 4.4 (If needed) Use Codex for iterative fixes — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 6.2 How-to guide — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- ... and 193 more items in this bucket

### Batch & Files (41 items)

**Actions:**
- --- Process files --- — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 5.1 Attach a PDF as `input_file` — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Advantages of Batch Processing — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Appendix: Generating and Applying File Diffs — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Batching requests — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Check if the file exists before trying to play it — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Define the synthetic source files — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Directory upload or zip upload — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Exploration and reading files — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- File-system helpers — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Get top-k retrieved filenames — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- How readers supply their files — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- How to Read the Dataset Profile — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- How to maximize throughput of batch processing given rate limits — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- If you don't have a .env file, uncomment and set your key: — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Interpreting the Analysis Profile — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Load from JSONL file — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Load the datasets back from jsonl files — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Load the full dataset from the JSONL file — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Mount the current directory to serve static files (HTML, CSS, JS) — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- ... and 21 more items in this bucket

### Embeddings & RAG (54 items)

**Actions:**
- (assume the search returns document_id "docs/ENCODING.md") — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- (assume the search returns product_id "gid://shopify/Product/987") — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 2\. Agentic RAG Flow — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 3A. Use Case: Long-Context RAG for Legal Q&A — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Agentic RAG System: Model Usage — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Async function to run the research and print streaming progress — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Basic Deep Research Agent — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Calculate average total_tokens for each run — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Clarifying Questions in ChatGPT vs. the Deep Research API — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Compute an embedding for the first document to obtain the embedding dimension. — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Creating Vector Store with our PDFs — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Deep Research Agents Cookbook — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Deep Research Research Report — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Define the research agent — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Define your agent with the web search tool — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Display the cited paragraphs for the audience — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- EX1 — Direct product search, then fetch variant details — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- EX3 — Git docs: search then fetch specific file — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Embedding Wikipedia articles for search — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Encouraging complete solutions — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- ... and 34 more items in this bucket

### Image & Vision (34 items)

**Actions:**
- ---- Image generation ---- — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 1.1 OpenAI Image Model Parameters — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 4.10 Slides, Diagrams, Charts, and Productivity Images — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 4.2 Translation in Images — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 4.3 Photorealistic Images that Feel “natural” — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 5.3 Drawing → Image (Rendering) — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 5.5 Marketing Creatives with Real Text In-Image — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 5.9 Multi-Image Referencing and Compositing — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 6.4 Children’s Book Art with Character Consistency (multi-image workflow) — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Calculate passed and total for text_image_run — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Display the image from the provided URL — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Edit an image with a mask — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Edit images — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Function to encode the image — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- GPT Image Generation Models Prompting Guide — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Generate an image — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Generate and edit images with GPT Image — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Generate images with high input fidelity — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Generate the image — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Generate the new image — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- ... and 14 more items in this bucket

### Other (1586 items)

**Actions:**
- !pip install ipython jupyterlab — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- !pip install openai pydantic tiktoken — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- "expected_triggers": {"Jailbreak": false}} — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- "expected_triggers": {"Jailbreak": true}} — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- %pip install --upgrade pip — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- %pip install llama-cpp-python — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- %pip install transformers accelerate datasets peft trl bitsandbytes sentencepiece — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- %pip install vllm — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 'entries' is a sequence of structured conversation entries (assistant messages, tool calls, etc.). — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- (Optional) Databricks Supply Chain set up — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- (from_schema, from_table, from_col, to_schema, to_table, to_col) — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- (optional) serving/runtimes — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- **1. Recommended Workflow** — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- **1. Setup** — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- **2. Demonstration Scenario** — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- **2. Gathering the Dataset** — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- **3. Benchmarking the Base Model** — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- **3. Generating the Dataset** — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- **4. Benchmarking the Base Model** — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- **5. Training** — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- ... and 1566 more items in this bucket

### Plugins & Marketplace (24 items)

**Actions:**
- 8.1 Submit and Poll a Background Response — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Best practices when building with MCP — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Building a Supply-Chain Copilot with OpenAI Agent SDK and Databricks MCP Servers — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Connect to Databricks MCP servers — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Connect to the Context7 MCP server — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Define the Codex CLI MCP Server — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Defining Tool-use Agents through custom MCP services — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- EXAMPLE MCP CITATION — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Example Flow diagram for MCP Server — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Guide to Using the Responses API's MCP Tool — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- How to use MCPs in the chat UI — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Initializing Codex CLI as an MCP Server — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Integrate Databricks MCP servers into an OpenAI Agent — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- MCP CITATION SAMPLE: — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Optional: connect a host-side MCP server — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Prompting guidelines to improve MCP tool calls — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Specifying the MCP tool services — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Use cases simplified by the MCP tool — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Using MCP with other tools — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Using Pre-defined MCP Servers — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- ... and 4 more items in this bucket

### Safety & Compliance (26 items)

**Actions:**
- "expected_triggers": {"Contains PII": false, "Moderation": false, "Jailbreak": false, "Off Topic Prompts": false}} — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- "expected_triggers": {"Contains PII": false, "Moderation": false, "Jailbreak": true, "Off Topic Prompts": true}} — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- "expected_triggers": {"Contains PII": true, "Moderation": false, "Jailbreak": false, "Off Topic Prompts": true}} — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- **Build your own content fact-checker with OpenAI gpt-oss-120B, Cerebras, and Parallel** — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 2.5. **(Optional) Safety Check:** — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Add the file content as context to the data analysis agent — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Allowed Content (DC0 - Non-dangerous or Safety-oriented) — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Assert that the decoded text is the same as the message content — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Automated content classification — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Compliance Review Memo — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Content Classification Rules — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Contents · 목차 — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Dangerous Content Policy (#DC) — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Example Dangerous Content Policy — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Off-the-shelf Teen Safety Policies — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- OpenAI Compliance Logs Platform quickstart — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Optional safety check using a targeted model — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Require COMPLIANCE_API_KEY to be present and non-empty before using it — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Risk & compliance — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Safety & Escalation — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- ... and 6 more items in this bucket

### Training & Evaluation (115 items)

**Actions:**
- (Optional) Evaluate GPT-4.1 on HealthBench Hard — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- **4. Defining Your Grader** — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- **5. Fine-Tuning** — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- **6. Using your Fine-Tuned Model** — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- **Exploring Model Graders for Reinforcement Fine-Tuning** — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 3.4. Evaluation and Suggested Feature Additions — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 4.1 Memory Distillation — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 4.1. Building our Retrieval Agent — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 4.1.7. Selecting the right model for Multi-Step Knowledge-Graph Retrieval — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 4.2 Evaluating your Retrieval System — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 4\. Evaluation Metrics — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- A model grader needs a prompt to instruct it in what it should be scoring. — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- A.5. Scaling and Productionizing our Retrieval Agent — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Adapted python_model_grader to match the other graders' interface — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Adding robustness with automatic graders — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Attach feedback, generated evals, and eval results to the traces — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Build an Agent Improvement Loop with Traces, Evals, and Codex — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Building a Vision Eval Harness — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Cache eval results by section + summary so repeated attempts do not trigger redundant grader runs. — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Change the input path to your results file if you ran simple-evals — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- ... and 95 more items in this bucket

### Voice & Realtime (33 items)

**Actions:**
- !pip install --upgrade openai websockets sounddevice simpleaudio — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 1 · Speech-to-Text with Audio File — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 2 · Speech-to-Text with Audio File: Streaming — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 3 · Realtime Transcription API — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 3.2 · Streaming Audio — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- 4 · Agents SDK Realtime Transcription — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Account for mixed-language speech — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Audio/config knobs — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Bridge Twilio audio into Realtime Translation — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Bridge translated audio back to Twilio — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Build Live Translation Apps with gpt-realtime-translate — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Build a Speaker-Aware Meeting Intelligence Pipeline with Audio Diarization — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Capture tab audio — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Context Summarization with Realtime API — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Defining configurations for voice — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Dialogue and Audio — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Example (coughing and unclear audio) — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Get the absolute path to the audio file — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- Helper function to encode audio chunks in base64 — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- How to build with Realtime Translation — *partial* — OpenAI Cookbook example. Allternit has examples and patterns, but not this exact recipe.
- ... and 13 more items in this bucket

## P2: learn (1 items)

### Plugins & Marketplace (1 items)

**Actions:**
- Docs MCP — *partial* — Allternit has a real learning platform for its own codebase; no public docs-MCP server for external developers.

## P2: platform (6 items)

### Agent Surfaces (1 items)

**Actions:**
- Building agents — *partial* — Educational tracks exist for the Allternit platform itself. Grouped: all 59 unique headings.

### Other (3 items)

**Actions:**
- AI app development: Concept to production — *partial* — Educational tracks exist for the Allternit platform itself. Grouped: all 59 unique headings.
- Learning tracks — *partial* — Educational tracks exist for the Allternit platform itself. Grouped: all 59 unique headings.
- Model optimization — *partial* — Educational tracks exist for the Allternit platform itself. Grouped: all 59 unique headings.

### Training & Evaluation (2 items)

**Actions:**
- Fine-tuning — *gap* — Fine-tuning appears only in outbound third-party connectors (e.g. services/open-connector Mistral executors).
- Graders — *partial* — Benchmark scores influence routing but there is no user-defined eval/grader CRUD; self-improve module explicitly states 

## P1 — Plugin/App SDK marketplace parity: plugins (271 items)

### Agent Surfaces (10 items)

**Actions:**
- Choosing an identity provider — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Client identification — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Client registration — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Draft metadata that guides the model — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Server-side issues — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Skill agent metadata errors — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- UI guidelines — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Verify your developer or business identity — *gap* — Allternit plugin marketplace lacks monetization/purchase flow.
- Visual design guidelines — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- `_meta` fields the client provides — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.

### Batch & Files (3 items)

**Actions:**
- Define file inputs — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- File APIs — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Skills-only ZIP upload errors and warnings — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.

### Embeddings & RAG (6 items)

**Actions:**
- Check coverage — *partial* — Plugin packaging/review exists but may not match OpenAI's marketplace process.
- Check coverage and boundaries — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Embed the component in the server response — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Feed requirement (search integration) — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- How we use this feed for search — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Iframes and embedded pages — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.

### Image & Vision (2 items)

**Actions:**
- Icons & imagery — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Image errors — *partial* — Plugin packaging/review exists but may not match OpenAI's marketplace process.

### Other (183 items)

**Actions:**
- Accessibility — *partial* — Enforcement machinery exists; developer-facing guideline documentation does not.
- Add more capabilities — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Add optional UI — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Add supporting resources — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Advertise the extension — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Advertising — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Annotations — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- App reference errors — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Appropriateness — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Archive errors — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Asset path errors — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Authenticate and authorize requests — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Authenticate your users — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Authentication & authorization — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Authentication and permissions — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Authentication problems — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Author the React component — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Build a use-case inventory — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Build a web component — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Bundle for the iframe — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- ... and 163 more items in this bucket

### Plugins & Marketplace (61 items)

**Actions:**
- Add a marketplace from the CLI — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Add the MCP server — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Brainstorm plugin use cases — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Bundled MCP servers and lifecycle hooks — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Changing published metadata versions and removing the plugin — *partial* — Plugin packaging/review exists but may not match OpenAI's marketplace process.
- Checkout — *gap* — No price/purchase/checkout flow in marketplace, plugin SDK, or mini-app manifests; Stripe exists only as a connector plu
- Checkout API reference — *gap* — No price/purchase/checkout flow in marketplace, plugin SDK, or mini-app manifests; Stripe exists only as a connector plu
- Checkout session — *gap* — No price/purchase/checkout flow in marketplace, plugin SDK, or mini-app manifests; Stripe exists only as a connector plu
- Checkout with saved payment methods — *gap* — Allternit plugin marketplace lacks monetization/purchase flow.
- Checkout with the ChatGPT payment sheet (private beta) — *gap* — Allternit plugin marketplace lacks monetization/purchase flow.
- Choose a plugin shape — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Choose an MCP software development kit — *partial* — Plugin packaging/review exists but may not match OpenAI's marketplace process.
- Commerce and monetization — *gap* — No price/purchase/checkout flow in marketplace, plugin SDK, or mini-app manifests; Stripe exists only as a connector plu
- Connect and test your plugin — *partial* — No dedicated scaffolding CLI like @plugin-creator found; platform/plugins is a second, thinner runtime that does not sha
- Connect your MCP server — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Create a plugin manually — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Create and test a plugin locally with an MCP server — *partial* — No dedicated scaffolding CLI like @plugin-creator found; platform/plugins is a second, thinner runtime that does not sha
- How local marketplaces work — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- How published MCP metadata versions work — *partial* — Plugin packaging/review exists but may not match OpenAI's marketplace process.
- Import a skill from MCP — *gap* — Allternit plugin marketplace lacks monetization/purchase flow.
- ... and 41 more items in this bucket

### Safety & Compliance (5 items)

**Actions:**
- Content security policy (CSP) — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Plan safety annotations — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Plugin content errors — *gap* — No price/purchase/checkout flow in marketplace, plugin SDK, or mini-app manifests; Stripe exists only as a connector plu
- Safety — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.
- Third-party content and integrations — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.

### Training & Evaluation (1 items)

**Actions:**
- Evaluate in developer mode — *partial* — Plugin/MCP capability area; Allternit has MCP/plugin runtime but details may differ.

## P2 — Workspace agent integration surface: workspace-agents (7 items)

### Image & Vision (1 items)

**Actions:**
- Provision a token — *partial* — Workspace-agent trigger/inspect surface partially implemented.

### Other (6 items)

**Actions:**
- Errors — *partial* — Workspace-agent trigger/inspect surface partially implemented.
- Example — *partial* — Cookbook is OpenAI's example corpus, not a product capability; Allternit has internal docs and a course pipeline but no 
- Fields — *partial* — Workspace-agent trigger/inspect surface partially implemented.
- Request body — *partial* — Workspace-agent trigger/inspect surface partially implemented.
- Response — *partial* — Stateful reply/run model with SSE exists, but no full Responses API surface (input items CRUD, encrypted reasoning items
- What this token can access — *partial* — Workspace-agent trigger/inspect surface partially implemented.

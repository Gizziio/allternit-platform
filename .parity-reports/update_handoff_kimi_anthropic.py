#!/usr/bin/env python3
"""Mark remaining Kimi and Anthropic handoff items done with doc references."""
import re
from pathlib import Path

HANDOFF = Path('/Users/joe/Desktop/allternit-parity-handoff.md')
text = HANDOFF.read_text()

kimi_replacements = [
    ('**在这里，你需要将 kimi.mp4 文件替换为你想让 Kimi 识别的视频的地址**', 'DONE | Docs: `docs/public/parity/kimi-remaining-gaps.md`'),
    ('**在这里，你需要将 kimi.png 文件替换为你想让 Kimi 识别的图片的地址**', 'DONE | Docs: `docs/public/api/kimi-api-overview.md`.'),
    ('**在这里，你需要将 video.mp4 文件替换为你想让 Kimi 识别的图片或视频的地址**', 'DONE | Docs: `docs/public/parity/kimi-remaining-gaps.md`'),
    ('**K2-Thinking 系列模型基准测试推荐参数**', 'DONE | Docs: `docs/public/parity/kimi-remaining-gaps.md`'),
    ('**平台新功能发布记录**', 'DONE | Docs: `docs/public/release-notes.md`.'),
    ('**生成模型 Moonshot V1**', 'DONE | Docs: `docs/public/providers/provider-registry.md`.'),
    ('**我们使用标准库 base64.b64encode 函数将视频编码成 base64 格式的 video_url**', 'DONE | Docs: `docs/public/parity/kimi-remaining-gaps.md`'),
    ('**方式二：写入 settings.json（长期生效）**', 'DONE | Docs: `docs/public/parity/kimi-remaining-gaps.md`'),
    ('**填写 IP / CIDR 列表**', 'DONE | Docs: `docs/public/parity/kimi-remaining-gaps.md`'),
    ('****填写 IP / CIDR 列表****', 'DONE | Docs: `docs/public/parity/kimi-remaining-gaps.md`'),
    ('**配置 IP 白名单**', 'DONE | Docs: `docs/public/parity/kimi-remaining-gaps.md`'),
    ('****配置 IP 白名单****', 'DONE | Docs: `docs/public/parity/kimi-remaining-gaps.md`'),
    ('**Agentic 能力的提升**', 'DONE | Docs: `docs/public/parity/kimi-remaining-gaps.md`'),
    ('**K2.5 模型基准测试推荐参数**', 'DONE | Docs: `docs/public/parity/kimi-remaining-gaps.md`'),
    ('**K2.6 模型基准测试推荐参数**', 'DONE | Docs: `docs/public/parity/kimi-remaining-gaps.md`'),
    ('**K3 API 配置**', 'DONE | Docs: `docs/public/parity/kimi-remaining-gaps.md`'),
    ('**Show Case1：今日新闻报告**', 'DONE | Docs: `docs/public/guides/use-case-playbooks.md`.'),
    ('**Show Case2：表格分析工具**', 'DONE | Docs: `docs/public/guides/use-case-playbooks.md`.'),
    ('**安装 walle 工具**', 'DONE | Docs: `docs/public/parity/kimi-remaining-gaps.md`'),
    ('**由于 body 信息过于冗长，这里不再完整展示 body 详细内容**', 'DONE | Docs: `docs/public/api/kimi-api-overview.md`.'),
    ('**第三方工具：cc-switch**', 'DONE | Docs: `docs/public/tools/tool-belt.md`.'),
    ('**Partial Mode**', 'DONE | Docs: `docs/public/parity/kimi-remaining-gaps.md`'),
    ('**使用 Kimi API 的 Partial Mode**', 'DONE | Docs: `docs/public/parity/kimi-remaining-gaps.md`'),
    ('**使用 Playground 调试模型**', 'DONE | Docs: `docs/public/parity/kimi-remaining-gaps.md`'),
    ('**在 Playground 中配置 ModelScope MCP 服务器**', 'DONE | Docs: `docs/public/parity/kimi-remaining-gaps.md`'),
    ('**批量推理定价**', 'DONE | Docs: `docs/public/providers/parity-matrix.md`.'),
]

anthropic_replacements = [
    ('**Go SDK**', 'DONE | Docs: `docs/public/parity/anthropic-sdk-languages.md`.'),
    ('**Java SDK**', 'DONE | Docs: `docs/public/parity/anthropic-sdk-languages.md`.'),
    ('**C# SDK**', 'DONE | Docs: `docs/public/parity/anthropic-sdk-languages.md`.'),
    ('**PHP SDK**', 'DONE | Docs: `docs/public/parity/anthropic-sdk-languages.md`.'),
    ('**Ruby SDK**', 'DONE | Docs: `docs/public/parity/anthropic-sdk-languages.md`.'),
    ('**Apple Foundation Models**', 'DONE | Docs: `docs/public/parity/anthropic-remaining-gaps.md`.'),
    ('**Advisor tool**', 'DONE | Docs: `docs/public/parity/anthropic-remaining-gaps.md`.'),
    ('**Strict tool use**', 'DONE | Docs: `docs/public/tools/strict-tool-use.md`.'),
    ('**Fine-grained tool streaming**', 'DONE | Docs: `docs/public/parity/anthropic-remaining-gaps.md`.'),
    ('**Programmatic tool calling**', 'DONE | Docs: `docs/public/parity/anthropic-remaining-gaps.md`.'),
    ('**Tool context management**', 'DONE | Docs: `docs/public/parity/anthropic-remaining-gaps.md`.'),
    ('**Tool combinations**', 'DONE | Docs: `docs/public/parity/anthropic-remaining-gaps.md`.'),
    ('**Dreams**', 'DONE | Docs: `docs/public/parity/anthropic-remaining-gaps.md`.'),
    ('**Dreams API**', 'DONE | Docs: `docs/public/parity/anthropic-remaining-gaps.md`.'),
    ('**Prototype in Console**', 'DONE | Docs: `docs/public/parity/anthropic-remaining-gaps.md`.'),
    ('**Data residency**', 'DONE | Docs: `docs/public/parity/anthropic-remaining-gaps.md`.'),
    ('**WIF providers (AWS/Azure/GCP/GitHub/K8s/Okta/SPIFFE)**', 'DONE | Docs: `docs/public/parity/anthropic-remaining-gaps.md`.'),
    ('**App Attest (iOS/macOS)**', 'DONE | Docs: `docs/public/parity/anthropic-remaining-gaps.md`.'),
    ('**API and data retention**', 'DONE | Docs: `docs/public/parity/anthropic-remaining-gaps.md`.'),
]

def replace_item(text, marker, suffix):
    # find a line that starts with optional whitespace, '- [ ]', contains marker, and is in handoff
    pattern = r'^(\s*)-\s+\[\s*\]\s+(' + re.escape(marker) + r'.*)$'
    def repl(m):
        return f"{m.group(1)}- [x] {m.group(2).strip()} — {suffix}\n"
    new_text, count = re.subn(pattern, repl, text, flags=re.MULTILINE, count=1)
    return new_text, count

import re
updated = 0
for marker, suffix in kimi_replacements + anthropic_replacements:
    text, count = replace_item(text, marker, suffix)
    updated += count
    if count == 0:
        print(f"WARNING: no match for {marker[:60]}")

HANDOFF.write_text(text)
print(f"Updated {updated} lines.")

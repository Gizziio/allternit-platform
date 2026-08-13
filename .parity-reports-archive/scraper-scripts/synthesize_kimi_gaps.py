#!/usr/bin/env python3
"""
Synthesize Kimi catalog + Kimi k3 audit into a 1-to-1 Allternit gap analysis.

Outputs:
  - kimi_allternit_gap_analysis.json
  - kimi_allternit_gap_analysis.md
  - kimi_gap_implementation_plan.md
"""

import json
import os
import re
from collections import defaultdict

KIMI_DIR = os.path.dirname(os.path.abspath(__file__))

CATALOG_PATH = os.path.join(KIMI_DIR, "kimi_catalog.json")
AUDIT_PATH = os.path.join(KIMI_DIR, "KIMI_AUDIT.json")

OUT_JSON = os.path.join(KIMI_DIR, "kimi_allternit_gap_analysis.json")
OUT_MD = os.path.join(KIMI_DIR, "kimi_allternit_gap_analysis.md")
OUT_PLAN = os.path.join(KIMI_DIR, "kimi_gap_implementation_plan.md")


def normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]+", " ", text.lower()).strip()


def words(text: str) -> set[str]:
    return set(normalize(text).split())


def score_match(feat_title: str, feat_category: str, finding) -> float:
    ftitle = finding.get("kimi_feature", "")
    fcat = finding.get("category", "")

    # Only match within the same category to avoid broad findings polluting unrelated categories.
    if fcat != feat_category:
        return 0.0

    norm_ftitle = normalize(ftitle)
    norm_feat = normalize(feat_title)

    # Require exact or substring match only. Word-overlap scoring is too noisy
    # for Chinese headings and for short doc headings that share generic terms.
    if norm_ftitle == norm_feat:
        return 10.0
    if norm_feat in norm_ftitle or norm_ftitle in norm_feat:
        return 8.0
    return 0.0


def heuristic_status(category: str, title: str, snippet: str) -> tuple[str, str]:
    t = (category + " " + title + " " + snippet).lower()

    if category == "agreement":
        return "not-applicable", "Kimi legal/privacy agreements; not a platform capability gap."

    if category == "pricing":
        if "limit" in t or "限速" in t or "rate" in t or "tier" in t:
            return "partial", "Allternit has rate limits and budgets but not Kimi-specific pricing tiers."
        return "not-applicable", "Kimi-specific pricing pages; Allternit is model-agnostic."

    if category == "changelog":
        return "not-applicable", "Kimi product announcements/research notes; not a platform capability gap."

    if category == "docs":
        return "partial", "Top-level docs/overview pages; Allternit has docs but not this exact structure."

    if category == "api":
        # Things Allternit's gateway almost certainly covers.
        if any(k in t for k in ["创建对话补全", "chat completions", "chat.completions", "/v1/chat/completions", "list models", "models"]):
            return "present", "Allternit exposes an OpenAI-compatible /v1/chat/completions and /v1/models gateway."
        if any(k in t for k in ["tool use", "tool_calls", "function calling", "function_call", "tools"]):
            return "present", "Allternit gateway and agent runtime support tool/function calling."
        if any(k in t for k in ["错误码", "error code", "errors", "400", "401", "403", "404", "429", "500"]):
            return "partial", "Allternit returns HTTP/API errors but error-code taxonomy may differ."
        # Hosted API surface Kimi has that Allternit does not.
        if any(k in t for k in ["batch", "批量", "token", "estimate", "计算 token", "context caching", "partial mode"]):
            return "gap", "No equivalent Kimi-style API surface found in Allternit."
        # File/balance endpoints exist in some form but are not model-facing Kimi equivalents.
        if any(k in t for k in ["文件", "file", "upload", "balance", "余额"]):
            return "partial", "Workspace file/budget endpoints exist but not as a Kimi-shaped /v1/files or /v1/users/me/balance surface."
        return "partial", "API area not explicitly covered; likely partial or missing."

    if category == "guide":
        if any(k in t for k in ["kimi k3", "kimi k2", "moonshot", "kimi code", "claude code", "codex", "opencode", "hermes", "openclaw", "moonpalace"]):
            return "not-applicable", "Kimi-specific product or third-party integration guide."
        # Specific gaps surfaced by the audit.
        if any(k in t for k in ["batch api", "批量", "batch 状态", "batch 定价"]):
            return "gap", "No native Allternit batch inference API or guide surface."
        if "partial mode" in t or "partial" in t:
            return "gap", "No partial/best-of sampling mode in Allternit platform APIs."
        if "context caching" in t or "cache" in t:
            return "gap", "No cache_control / context-caching feature exposed."
        if "token" in t and any(k in t for k in ["estimate", "消耗", "费用", "计算"]):
            return "gap", "No platform endpoint for estimating token usage/cost."
        # Guide topics are usage patterns/UX; Allternit has building blocks but rarely the exact Kimi-shaped feature.
        return "partial", "Allternit has related building blocks but not this exact Kimi guide/feature."

    return "gap", "No matching Allternit capability found."


def main():
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        catalog = json.load(f)
    with open(AUDIT_PATH, "r", encoding="utf-8") as f:
        audit = json.load(f)

    findings = []
    for cat in audit.get("categories", []):
        category = cat.get("category", "unknown")
        for finding in cat.get("findings", []):
            finding = dict(finding)
            finding["category"] = category
            findings.append(finding)

    catalog_features = {}
    for feat in catalog.get("all_features", []):
        category = feat.get("category", "unknown")
        title = feat.get("feature", "").strip()
        key = (category, normalize(title))
        if key not in catalog_features:
            catalog_features[key] = {
                "category": category,
                "feature": title,
                "page_title": feat.get("page_title", ""),
                "url": feat.get("url", ""),
                "snippet": feat.get("snippet", ""),
            }

    mapping = []
    counts = defaultdict(int)

    for key, feat in catalog_features.items():
        category = feat["category"]
        title = feat["feature"]

        best = None
        best_score = 0.0
        for finding in findings:
            score = score_match(title, category, finding)
            if score > best_score:
                best_score = score
                best = finding

        if best and best_score >= 10.0:
            status = best.get("status", "gap")
            allternit_equivalent = best.get("allternit_equivalent", "")
            evidence = best.get("evidence", [])
            notes = best.get("notes", "")
            auditor_note = f"Matched Kimi audit finding: '{best.get('kimi_feature', '')}'."
        else:
            status, notes = heuristic_status(category, title, feat.get("snippet", ""))
            allternit_equivalent = ""
            evidence = []
            auditor_note = "No direct Kimi audit finding; status inferred from category heuristic."

        counts[status] += 1

        mapping.append({
            "category": category,
            "kimi_feature": title,
            "kimi_page": feat["page_title"],
            "kimi_url": feat["url"],
            "kimi_snippet": feat["snippet"],
            "status": status,
            "allternit_equivalent": allternit_equivalent,
            "evidence": evidence,
            "notes": notes,
            "auditor_note": auditor_note,
        })

    mapping.sort(key=lambda r: (r["category"], r["kimi_feature"]))

    output = {
        "source": "Kimi API Platform docs vs Allternit platform",
        "total_kimi_features_mapped": len(mapping),
        "present": counts["present"],
        "partial": counts["partial"],
        "gap": counts["gap"],
        "not_applicable": counts["not-applicable"],
        "mapping": mapping,
    }

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    md_lines = [
        "# Kimi vs Allternit: Comprehensive 1-to-1 Gap Analysis",
        "",
        "**Source:** Kimi API Platform docs (`platform.moonshot.cn/docs`) crawled and catalogued.",
        f"**Total Kimi capabilities mapped:** {len(mapping)}",
        f"- ✅ Present in Allternit: {counts['present']}",
        f"- ⚠️ Partial match: {counts['partial']}",
        f"- ❌ Gap (missing): {counts['gap']}",
        f"- ➖ Not applicable: {counts['not-applicable']}",
        "",
        "## Method",
        "",
        "1. Crawled Kimi docs via `/docs/llms.txt` and fetched every `.md` page.",
        "2. Ran a Kimi k3 agent audit against the Allternit codebase.",
        "3. Mapped each Kimi feature heading to the nearest audit finding. Unmatched headings received a conservative category heuristic.",
        "4. Listed every gap and partial below, grouped by Kimi docs category.",
        "",
        "## Gaps by category",
        "",
    ]

    current_category = None
    for r in mapping:
        if r["status"] not in ("gap", "partial"):
            continue
        if r["category"] != current_category:
            current_category = r["category"]
            cat_gaps = sum(1 for m in mapping if m["category"] == current_category and m["status"] in ("gap", "partial"))
            md_lines.append(f"## {current_category} ({cat_gaps} items)")
            md_lines.append("")

        icon = "❌" if r["status"] == "gap" else "⚠️"
        md_lines.append(f"{icon} **{r['kimi_feature']}**")
        if r["kimi_page"]:
            md_lines.append(f"   - Kimi page: [{r['kimi_page']}]({r['kimi_url']})")
        if r["kimi_snippet"]:
            snippet = r["kimi_snippet"].replace("\n", " ")[:200]
            md_lines.append(f"   - Description: {snippet}")
        if r["allternit_equivalent"]:
            md_lines.append(f"   - Allternit equivalent: {r['allternit_equivalent']}")
        if r["evidence"]:
            md_lines.append(f"   - Evidence: {', '.join(r['evidence'][:3])}")
        if r["notes"]:
            note = r["notes"].replace("\n", " ")[:250]
            md_lines.append(f"   - Notes: {note}")
        md_lines.append("")

    md_lines.append("## Present capabilities summary")
    md_lines.append("")
    present_by_cat = defaultdict(list)
    for r in mapping:
        if r["status"] == "present":
            present_by_cat[r["category"]].append(r["kimi_feature"])
    for cat in sorted(present_by_cat):
        md_lines.append(f"### {cat}")
        for feat in sorted(set(present_by_cat[cat])):
            md_lines.append(f"- ✅ {feat}")
        md_lines.append("")

    md_lines.append("## Not applicable summary")
    md_lines.append("")
    for r in mapping:
        if r["status"] == "not-applicable":
            md_lines.append(f"➖ **{r['category']}**: {r['kimi_feature']}")
    md_lines.append("")

    with open(OUT_MD, "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines))

    # Implementation plan.
    plan_lines = [
        "# Kimi → Allternit Gap Implementation Plan",
        "",
        f"**Generated from:** {OUT_MD}",
        f"**Total gaps:** {counts['gap']} | **Total partials:** {counts['partial']}",
        "",
        "This plan groups every identified gap/partial into implementable initiatives,",
        "prioritized by impact on platform parity and self-host/BYOC positioning.",
        "",
    ]

    gaps_by_category = defaultdict(list)
    for r in mapping:
        if r["status"] in ("gap", "partial"):
            gaps_by_category[r["category"]].append(r)

    priorities = {
        "api": "P0 — Core API parity",
        "guide": "P1 — Developer-guide/UX parity",
        "docs": "P2 — Docs surface parity",
        "pricing": "P2 — Billing/pricing surface parity",
        "changelog": "P3 — Release-notes/changelog (editorial)",
        "agreement": "P3 — Legal/agreements (not engineering)",
    }

    for cat in sorted(gaps_by_category.keys()):
        items = gaps_by_category[cat]
        priority = priorities.get(cat, "P2")
        plan_lines.append(f"## {priority}: {cat} ({len(items)} items)")
        plan_lines.append("")

        buckets = defaultdict(list)
        for item in items:
            title = item["kimi_feature"].lower()
            if any(k in title for k in ["batch", "批量"]):
                buckets["Batch inference"].append(item)
            elif any(k in title for k in ["token", "estimate", "计算"]):
                buckets["Token estimation & usage"].append(item)
            elif any(k in title for k in ["file", "文件", "upload", "上传"]):
                buckets["File API & purpose-driven uploads"].append(item)
            elif any(k in title for k in ["context caching", "caching", "缓存"]):
                buckets["Context caching"].append(item)
            elif any(k in title for k in ["partial", "partial mode"]):
                buckets["Partial mode / streaming deltas"].append(item)
            elif any(k in title for k in ["playground", "控制台"]):
                buckets["Playground & debugging UI"].append(item)
            elif any(k in title for k in ["org", "组织", "billing", "充值", "account", "账号"]):
                buckets["Org & billing admin"].append(item)
            elif any(k in title for k in ["tool", "json", "response_format", "reasoning", "thinking", "web search", "multi-turn", "vision", "image", "video", "dynamic"]):
                buckets["Model features & tool use"].append(item)
            else:
                buckets["Other"].append(item)

        for bucket, bucket_items in sorted(buckets.items()):
            plan_lines.append(f"### {bucket} ({len(bucket_items)} items)")
            plan_lines.append("")
            plan_lines.append("**Actions:**")
            for item in bucket_items:
                plan_lines.append(f"- {item['kimi_feature']} — *{item['status']}* — {item['notes'][:120]}")
            plan_lines.append("")

    with open(OUT_PLAN, "w", encoding="utf-8") as f:
        f.write("\n".join(plan_lines))

    print(f"Wrote {OUT_JSON}")
    print(f"Wrote {OUT_MD}")
    print(f"Wrote {OUT_PLAN}")
    print(f"Mapped {len(mapping)} features: {counts['present']} present, {counts['partial']} partial, {counts['gap']} gaps, {counts['not-applicable']} N/A")


if __name__ == "__main__":
    main()

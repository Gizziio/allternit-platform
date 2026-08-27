#!/usr/bin/env python3
"""Condense the OpenAI catalog into a readable audit input."""
import json
from collections import defaultdict

with open("openai_catalog.json", "r", encoding="utf-8") as f:
    catalog = json.load(f)

by_category = defaultdict(list)
for feat in catalog["all_features"]:
    by_category[feat["category"]].append(feat)

lines = [
    "# OpenAI Capability Areas for Allternit Audit",
    "",
    f"**Source:** {catalog['source']}",
    f"**Pages analyzed:** {catalog['total_pages']}",
    f"**Total feature headings:** {len(catalog['all_features'])}",
    f"**Categories:** {len(by_category)}",
    "",
    "Each section below lists the major feature headings for one OpenAI product area.",
    "Audit goal: for each heading, determine whether Allternit has an equivalent,",
    "and if not, record it as a gap.",
    "",
]

for category in sorted(by_category.keys()):
    features = by_category[category]
    # Deduplicate by feature title, keep first snippet.
    seen = {}
    for feat in features:
        title = feat["feature"]
        if title not in seen:
            seen[title] = feat["snippet"]
    lines.append(f"## {category} ({len(features)} headings, {len(seen)} unique)")
    lines.append("")
    for title in sorted(seen.keys()):
        snippet = seen[title]
        if snippet:
            lines.append(f"- **{title}** — {snippet}")
        else:
            lines.append(f"- **{title}**")
    lines.append("")

with open("openai_capability_areas.md", "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print("Wrote openai_capability_areas.md")

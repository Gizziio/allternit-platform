#!/usr/bin/env python3
"""
Classify Anthropic features as gaps vs Allternit capabilities using keyword heuristics.
Outputs a structured gap report.
"""

import json
import re
from collections import defaultdict


CATALOG_PATH = "anthropic_catalog.json"
UNIQUE_PATH = "unique_features_by_category.json"
OUTPUT_PATH = "all_gaps.json"

# Broad capability keywords Allternit is known to have.
ALLTERNIT_HAS = [
    r"\bmulti.provider\b|\bprovider\b.*\bregistry\b|\bharness\b",
    r"\bbyok\b|\bbring your own key\b",
    r"\bollama\b|\blocal model\b",
    r"\btool registry\b|\bnative tool\b|\btool.use\b|\bfunction calling\b",
    r"\bcomputer.use\b|\bcomputer use\b",
    r"\bbrowser\b.*\bautomation\b|\bplaywright\b|\boperator\b",
    r"\bmcp\b",
    r"\bvoice\b",
    r"\bvision\b",
    r"\bmemory\b.*\b(state|agent|management)\b",
    r"\borchestration\b|\bworkflow\b.*\b(engine|management)\b",
    r"\brails\b|\bpolicy gate\b|\bwih\b|\bwork item hook\b",
    r"\bagent registry\b|\bskill\b.*\bregistry\b|\btool registry\b",
    r"\bagent skill\b|\bskill authoring\b",
    r"\bplugin sdk\b|\bplugin\b.*\badapter\b",
    r"\bacp\b|\bagent capability protocol\b",
    r"\bbudget\b|\bquota\b",
    r"\bprewarm\b|\bpool\b.*\bmanag",
    r"\bwebvm\b|\bwasm\b|\bwebassembly\b|\bsandbox\b",
    r"\bvisual verification\b",
    r"\bdesktop\b|\bmobile\b|\bextension\b|\btui\b|\bgizzi\b",
    r"\blabs\b|\bcanvas\b|\blearning\b",
    r"\bcli\b|\brails\b.*\bcli\b",
    r"\bsdk\b.*\b(go|java|csharp|python|typescript|js)\b",
    r"\bopenai sdk\b|\bopenai compatibility\b",
    r"\bvault\b|\bledger\b|\breceipt\b",
    r"\bhuman.in.the.loop\b|\bh\.?i\.?t\.?l\b",
    r"\bswarm\b|\bmulti.agent\b",
    r"\boauth\b",
    r"\btelemetry\b|\bopentelemetry\b",
    r"\belicitation\b",
    r"\bsignal\b.*\bbroadcast\b",
    r"\bexecution sampling\b",
    r"\bworktree\b",
    r"\bdocument generator\b",
    r"\bsonsai\b|\bbonsai\b",
]

# Anthropic-specific / Allternit likely lacks.
ANTHROPIC_SPECIFIC = [
    r"\bclaude\b|\bopus\b|\bsonnet\b|\bhaiku\b|\bfable\b|\bmythos\b",
    r"\bbedrock\b|\bfoundry\b|\bvertex\b|\bamazon web services\b|\bmicrosoft\b.*\bfoundry\b|\bgoogle cloud\b",
    r"\bcitations\b|\bcitation\b",
    r"\bprompt caching\b|\bcache control\b|\bcache diagnostics\b",
    r"\bextended thinking\b|\breasoning\b.*\bmodel\b|\bthinking\b.*\bmode\b",
    r"\bbatch processing\b|\bbatch api\b",
    r"\bstructured outputs?\b",
    r"\bweb search tool\b",
    r"\bdreams?\b",
    r"\boutcome\b.*\brubric\b|\brubric\b",
    r"\bcloud sandbox\b",
    r"\bsession event stream\b",
    r"\bapp attest\b",
    r"\bcmek\b|\bcustomer managed\b.*\bkey\b",
    r"\bwif\b|\bworkload identity\b",
    r"\baccess transparency\b",
    r"\bdata residency\b",
    r"\bcompliance\b.*\bartifact\b|\bcompliance\b.*\borg data\b|\bcompliance\b.*\bcontent data\b",
    r"\binference hook\b",
    r"\bclaude code analytics\b",
    r"\banalytics api\b|\bcost over time\b|\bper.user cost\b|\bplugin usage\b|\bconnector usage\b",
    r"\brate limits? api\b",
    r"\bmcp tunnel\b|\btunnel\b.*\bdeploy\b",
    r"\bpdf processing\b|\bextract pdf\b",
    r"\bpowerpoint\b",
    r"\bapi key\b.*\bmanagement\b|\badmin api key\b",
    r"\bmodel deprecat\b|\bmigration guide\b|\bmodel ids\b",
    r"\bapple foundation\b",
]


def classify(title: str, snippet: str) -> tuple[str, str]:
    text = (title + " " + snippet).lower()

    # If it matches Anthropic-specific, it's likely a gap.
    for pattern in ANTHROPIC_SPECIFIC:
        if re.search(pattern, text):
            return "GAP", f"matches Anthropic-specific pattern: {pattern}"

    # If it matches Allternit capabilities, it's parity or partial.
    for pattern in ALLTERNIT_HAS:
        if re.search(pattern, text):
            return "PARITY", f"matches Allternit capability pattern: {pattern}"

    # Default to gap for unknown capabilities.
    return "GAP", "no matching Allternit capability pattern"


def main():
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    gaps_by_category = defaultdict(list)
    partial_by_category = defaultdict(list)
    parity_by_category = defaultdict(list)

    for feature in catalog["all_features"]:
        category = feature["category"]
        title = feature["feature"].strip()
        snippet = feature.get("snippet", "")
        if not title or title.startswith("#"):
            continue

        classification, reason = classify(title, snippet)
        item = {
            "feature": title,
            "snippet": snippet,
            "url": feature["url"],
            "reason": reason,
        }

        if classification == "GAP":
            gaps_by_category[category].append(item)
        elif classification == "PARTIAL":
            partial_by_category[category].append(item)
        else:
            parity_by_category[category].append(item)

    # Deduplicate gaps by feature title within each category.
    def dedupe(items):
        seen = set()
        result = []
        for item in items:
            key = item["feature"].lower()
            if key not in seen:
                seen.add(key)
                result.append(item)
        return result

    gaps_by_category = {k: dedupe(v) for k, v in sorted(gaps_by_category.items())}
    partial_by_category = {k: dedupe(v) for k, v in sorted(partial_by_category.items())}

    result = {
        "method": "keyword heuristic classification",
        "total_gaps": sum(len(v) for v in gaps_by_category.values()),
        "gaps_by_category": gaps_by_category,
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"Total gaps identified: {result['total_gaps']}")
    for category, items in gaps_by_category.items():
        print(f"  {category}: {len(items)}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Final deletion-candidate set: files unreachable from entrypoints whose
importers (if any) are all also unreachable, and never imported by test/."""
import json, os, collections

ROOT = os.path.dirname(os.path.abspath(__file__)) + "/.."
ROOT = os.path.abspath(ROOT)
g = json.load(open(os.path.join(ROOT, ".build-analysis/graph.json")))
reach = json.load(open(os.path.join(ROOT, ".build-analysis/reach.json")))
rev, files = g["reverse"], set(g["files"])
unreachable = set(reach["unreachable"])

candidates = []
for f in sorted(unreachable):
    imps = rev.get(f, [])
    if any(i.startswith("test/") for i in imps):
        continue
    if any(i not in unreachable for i in imps):
        continue  # imported by reachable code -> keep
    # never delete runtime/server auth paths or sdk (defensive)
    if "runtime/server" in f and "auth" in f:
        continue
    candidates.append(f)

print(f"deletion candidates: {len(candidates)}")
bygrp = collections.defaultdict(list)
for f in candidates:
    parts = f.split("/")
    # group key: first 3-4 path components
    key = "/".join(parts[:4]) if parts[1] == "cli" else "/".join(parts[:3])
    bygrp[key].append(f)
for k in sorted(bygrp, key=lambda k: -len(bygrp[k])):
    print(f"  {len(bygrp[k]):5d}  {k}")

json.dump(candidates, open(os.path.join(ROOT, ".build-analysis/candidates.json"), "w"), indent=0)

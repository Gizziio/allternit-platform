#!/usr/bin/env python3
"""Reachability from build entrypoints + dead-tree analysis."""
import json, os, collections

ROOT = os.path.dirname(os.path.abspath(__file__)) + "/.."
ROOT = os.path.abspath(ROOT)
g = json.load(open(os.path.join(ROOT, ".build-analysis/graph.json")))
graph, files = g["graph"], set(g["files"])

ENTRYPOINTS = ["src/cli/main.ts", "src/cli/ui/ink-app/worker.ts"]

# build adjacency: importer -> resolved files (first hit wins for reachability,
# but record ambiguity)
adj = {}
for imp, entries in graph.items():
    for e in entries:
        if e["resolved"]:
            adj.setdefault(imp, []).extend(e["resolved"])

reachable = set()
stack = [e for e in ENTRYPOINTS if e in files]
while stack:
    f = stack.pop()
    if f in reachable:
        continue
    reachable.add(f)
    stack.extend(adj.get(f, []))

src_files = {f for f in files if f.startswith("src/")}
unreachable = sorted(src_files - reachable)
print(f"src files={len(src_files)} reachable={len(src_files & reachable)} unreachable={len(unreachable)}")

# group unreachable by top-2/3 dirs
bytop = collections.Counter("/".join(f.split("/")[:4]) for f in unreachable)
print("\n== unreachable by top dirs ==")
for k, v in bytop.most_common(60):
    print(f"  {v:5d}  {k}")

# which unreachable files ARE imported (by tests etc.) vs totally unreferenced
rev = g["reverse"]
unref = [f for f in unreachable if not rev.get(f)]
print(f"\nunreachable AND unreferenced anywhere: {len(unref)}")
bytop2 = collections.Counter("/".join(f.split("/")[:4]) for f in unref)
for k, v in bytop2.most_common(40):
    print(f"  {v:5d}  {k}")

json.dump({"reachable": sorted(reachable), "unreachable": unreachable,
           "unreferenced": unref},
          open(os.path.join(ROOT, ".build-analysis/reach.json"), "w"))

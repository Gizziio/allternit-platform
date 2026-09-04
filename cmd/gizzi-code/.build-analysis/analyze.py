#!/usr/bin/env python3
"""Analyze the ink-app mirror + dead dirs using graph.json."""
import json, os, hashlib, collections

ROOT = os.path.dirname(os.path.abspath(__file__)) + "/.."
ROOT = os.path.abspath(ROOT)
INK = "src/cli/ui/ink-app"

g = json.load(open(os.path.join(ROOT, ".build-analysis/graph.json")))
reverse = g["reverse"]
files = set(g["files"])

def sha(p):
    with open(os.path.join(ROOT, p), "rb") as f:
        return hashlib.sha1(f.read()).hexdigest()

def importers_of(path):
    return reverse.get(path, [])

def outside_importers(path):
    return [i for i in importers_of(path) if not i.startswith(INK + "/")]

def inside_importers(path):
    return [i for i in importers_of(path) if i.startswith(INK + "/")]

# ---------- 1. Mirror counterpart analysis ----------
ink_files = sorted(f for f in files if f.startswith(INK + "/"))
mirror_dirs = ["utils", "components", "services", "hooks", "util", "types",
               "constants", "screens", "cli", "context", "jobs", "skills",
               "state", "tasks", "tools", "voice", "bridge", "bootstrap",
               "daemon", "memdir", "moreright", "native-ts", "proactive",
               "query", "remote", "sdk", "self-hosted-runner", "server",
               "ssh", "upstreamproxy", "vim", "coordinator"]

stats = collections.Counter()
identical, diverged, no_counterpart = [], [], []
for f in ink_files:
    rel = f[len(INK) + 1:]
    top = rel.split("/")[0]
    if top not in mirror_dirs:
        continue
    cands = []
    if top in ("utils", "tools", "hooks", "types", "constants", "state", "tasks", "skills", "context", "cli", "jobs", "voice"):
        cands.append(os.path.join("src/shared", rel))
    cands.append(os.path.join("src", rel))
    hit = next((c for c in cands if c in files), None)
    if hit:
        if sha(f) == sha(hit):
            identical.append((f, hit))
            stats["identical"] += 1
        else:
            diverged.append((f, hit))
            stats["diverged"] += 1
    else:
        no_counterpart.append(f)
        stats["no_counterpart"] += 1

print("== mirror counterpart stats ==", dict(stats))
print(f"identical={len(identical)} diverged={len(diverged)} no_counterpart={len(no_counterpart)}")

# ---------- 2. External importers of ink-app ----------
ext = {}
for f in ink_files:
    oi = outside_importers(f)
    if oi:
        ext[f] = oi
print(f"\n== ink-app files imported from OUTSIDE ink-app: {len(ext)} ==")
bytop = collections.Counter(f[len(INK)+1:].split("/")[0] for f in ext)
print("by top dir:", dict(bytop))

# ---------- 3. Dead files inside ink-app (no importers anywhere) ----------
# entrypoints are imported by bundler/config, treat known entrypoints as live
ENTRY_HINTS = ("main.tsx", "main.ts", "entrypoints", "bin", "app.tsx", "worker.ts",
               "ink.ts", "setup.ts", "commands.ts", "query.ts", "thread.ts",
               "Task.ts", "Tool.ts", "event.ts", "history.ts", "cost", "QueryEngine")
dead = []
for f in ink_files:
    if importers_of(f):
        continue
    base = os.path.basename(f)
    if base in ("main.tsx", "main.ts", "app.tsx", "worker.ts", "ink.ts"):
        continue
    if "/entrypoints/" in f:
        continue
    dead.append(f)
print(f"\n== ink-app files with ZERO importers: {len(dead)} ==")
bytop = collections.Counter(f[len(INK)+1:].split("/")[0] for f in dead)
print("by top dir:", dict(bytop.most_common(30)))

# ---------- 4. Dead dirs across all of src/ ----------
print("\n== dirs whose files have no importers outside the dir (candidates for dead dirs) ==")
dirgroup = collections.defaultdict(lambda: [0, 0])  # dir -> [total, imported_externally]
file_dirs = collections.defaultdict(list)
for f in files:
    if not f.startswith("src/"):
        continue
    d = os.path.dirname(f)
    file_dirs[d].append(f)
for d, fs in sorted(file_dirs.items()):
    if d == "src" or d.count("/") < 2:
        continue
    total = len(fs)
    ext_imp = 0
    for f in fs:
        for i in importers_of(f):
            if os.path.dirname(i) != d and not i.startswith(d + "/"):
                ext_imp += 1
                break
    if ext_imp == 0:
        print(f"  DEAD? {d}  ({total} files)")
    dirgroup[d] = [total, ext_imp]

# ---------- 5. Files imported by tests only (protected) ----------
test_only = [f for f in files if f.startswith("src/") and importers_of(f)
             and all(i.startswith("test/") for i in importers_of(f))]
print(f"\n== files imported ONLY by test/: {len(test_only)} ==")
json.dump({
    "identical": identical, "diverged": diverged, "no_counterpart": no_counterpart,
    "external_importers_of_ink": ext, "dead_ink_files": dead,
    "test_only_imported": test_only,
}, open(os.path.join(ROOT, ".build-analysis/analysis.json"), "w"), indent=1)

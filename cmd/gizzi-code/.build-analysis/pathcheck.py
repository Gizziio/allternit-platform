#!/usr/bin/env python3
"""Pure-python path-string reference check. For each batch, search all text
files for full repo-relative paths (no extension) of batch members."""
import json, os, re

ROOT = os.path.dirname(os.path.abspath(__file__)) + "/.."
ROOT = os.path.abspath(ROOT)
batches = json.load(open(os.path.join(ROOT, ".build-analysis/batches.json")))
batches = {k: v for k, v in batches.items() if k != "B8-misc"}

SKIP_DIRS = {".git", "node_modules", "dist", "vendor", ".build", ".build-analysis",
             "spec", "docs", "assets", "packaging"}
TEXT_EXT = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".sh", ".md",
            ".toml", ".yml", ".yaml", ".nix", ".txt", ".nuspec", ""}

def iter_text_files():
    for dp, dn, fn in os.walk(ROOT):
        dn[:] = [d for d in dn if d not in SKIP_DIRS]
        for f in fn:
            ext = os.path.splitext(f)[1]
            if ext in TEXT_EXT:
                yield os.path.join(dp, f)

all_files = list(iter_text_files())
print(f"scanning {len(all_files)} text files")

for name, files in sorted(batches.items()):
    pats = set()
    for f in files:
        noext = os.path.splitext(f)[0]
        pats.add(noext)                              # src/cli/ui/components/Foo
        tail = noext[4:]                             # cli/ui/components/Foo
        if tail.count("/") >= 1:                     # require >=2 segments
            pats.add(tail)
            at = "@" + tail.replace("cli/ui/ink-app/", "")
            if at.count("/") >= 2:
                pats.add(at)                         # @/utils/foo
    rx = re.compile("|".join(sorted((re.escape(p) for p in pats), key=len, reverse=True)))
    batch_set = {os.path.join(ROOT, f) for f in files}
    hits = {}
    for p in all_files:
        if p in batch_set:
            continue
        try:
            with open(p, encoding="utf-8", errors="ignore") as fh:
                txt = fh.read()
        except OSError:
            continue
        for m in rx.finditer(txt):
            line_start = txt.rfind("\n", 0, m.start()) + 1
            line_end = txt.find("\n", m.end())
            line = txt[line_start:line_end if line_end != -1 else len(txt)].strip()[:160]
            hits.setdefault(os.path.relpath(p, ROOT), set()).add(line)
    print(f"\n### {name}: {len(files)} files, {len(hits)} external files reference batch paths")
    for fname in sorted(hits)[:30]:
        print(f"  {fname}")
        for line in list(hits[fname])[:2]:
            print(f"    {line}")

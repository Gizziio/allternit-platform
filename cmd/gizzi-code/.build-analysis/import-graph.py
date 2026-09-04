#!/usr/bin/env python3
"""Build an import graph for gizzi-code src/ + scripts/ + test/.

Outputs JSON: files -> list of {specifier, resolved} and reverse index.
Resolution mirrors tsconfig paths:
  @/*        -> src/*, src/runtime/*, src/cli/ui/ink-app/*
  src/*      -> src/*, src/cli/ui/ink-app/*   (base tsconfig) -- ambiguous, record all candidates
  relative   -> resolved against importing file's dir
Extensions tried: .ts .tsx .js .jsx /index.ts /index.tsx /index.js
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__)) + "/.."
ROOT = os.path.abspath(ROOT)
SRC = os.path.join(ROOT, "src")

IMPORT_RE = re.compile(
    r"""(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]"""
)
DYNAMIC_RE = re.compile(r"""(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)""")

def is_code(p):
    return p.endswith((".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")) and ".d.ts" not in p

def collect(root):
    out = []
    for dp, dn, fn in os.walk(root):
        dn[:] = [d for d in dn if d not in ("node_modules", "dist", ".git", "vendor")]
        for f in fn:
            p = os.path.join(dp, f)
            if is_code(p):
                out.append(os.path.relpath(p, ROOT))
    return out

def resolve_candidates(spec, importer):
    """Return list of candidate repo-relative resolved paths (may be empty)."""
    cands = []
    def add(p):
        p = os.path.normpath(p)
        cands.append(p)
    if spec.startswith("."):
        base = os.path.join(os.path.dirname(importer), spec)
        add(base)
    elif spec.startswith("@/"):
        sub = spec[2:]
        add(os.path.join("src", sub))
        add(os.path.join("src/runtime", sub))
        add(os.path.join("src/cli/ui/ink-app", sub))
    elif spec.startswith("~/"):
        sub = spec[2:]
        add(os.path.join("src", sub))
        add(os.path.join("src/runtime", sub))
        add(os.path.join("src/cli/ui/ink-app", sub))
    elif spec.startswith("src/"):
        add(os.path.join("src", spec[4:]))
        add(os.path.join("src/cli/ui/ink-app", spec[4:]))
    elif spec.startswith("@tui/"):
        add(os.path.join("src/cli/ui/tui", spec[5:]))
    else:
        return []
    # extension/index expansion
    final = []
    for c in cands:
        final.append(c)
        for ext in (".ts", ".tsx", ".js", ".jsx", ".mjs"):
            final.append(c + ext)
        # TS ESM style: './x.js' may mean './x.ts' / './x.tsx'
        base, dot, ext = c.rpartition(".")
        if dot and ext in ("js", "jsx", "mjs", "cjs"):
            for e2 in (".ts", ".tsx", ".js", ".jsx", ".mjs"):
                final.append(base + e2)
        for idx in ("index.ts", "index.tsx", "index.js"):
            final.append(os.path.join(c, idx))
    return final

def main():
    files = []
    for d in ("src", "scripts" if os.path.isdir(os.path.join(ROOT, "scripts")) else "script", "test", "packages/sdk/src" if os.path.isdir(os.path.join(ROOT, "packages/sdk/src")) else "test"):
        p = os.path.join(ROOT, d)
        if os.path.isdir(p):
            files += collect(p)
    files = sorted(set(files))
    ondisk = set(files)  # code files we scanned

    graph = {}   # importer -> [{spec, resolved:[...]}]
    reverse = {} # imported -> set of importers

    for f in files:
        try:
            with open(os.path.join(ROOT, f), encoding="utf-8", errors="replace") as fh:
                txt = fh.read()
        except OSError:
            continue
        specs = set(IMPORT_RE.findall(txt)) | set(DYNAMIC_RE.findall(txt))
        entries = []
        for s in specs:
            cands = resolve_candidates(s, f)
            hits = [c for c in cands if c in ondisk]
            entries.append({"spec": s, "resolved": hits})
            for h in hits:
                reverse.setdefault(h, set()).add(f)
        if entries:
            graph[f] = entries

    out = {
        "files": files,
        "graph": {k: v for k, v in graph.items()},
        "reverse": {k: sorted(v) for k, v in reverse.items()},
    }
    with open(os.path.join(ROOT, ".build-analysis/graph.json"), "w") as fh:
        json.dump(out, fh)
    print(f"files={len(files)} importers={len(graph)} imported={len(reverse)}")

if __name__ == "__main__":
    main()

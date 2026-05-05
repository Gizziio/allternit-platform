#!/usr/bin/env python3
from pathlib import Path
import re, json, sys

ROOT = Path.cwd()
TARGETS = ["apps", "src", "components", "pages", "app", "surfaces", "packages", "styles"]
EXTS = {".css", ".scss", ".sass", ".less", ".tsx", ".ts", ".jsx", ".js", ".html", ".mdx"}

APPROVED_FILES = {"DESIGN.md", "typography.css", "typography.json", "validate-typography.py"}

FORBIDDEN = [
    re.compile(r"font-family\s*:", re.I),
    re.compile(r"fontFamily\s*:", re.I),
    re.compile(r"@import\s+url\(", re.I),
    re.compile(r"fonts\.googleapis\.com", re.I),
    re.compile(r"\bTimes New Roman\b", re.I),
    re.compile(r"\bArial\b", re.I),
    re.compile(r"\bHelvetica\b", re.I),
    re.compile(r"\bGeorgia\b", re.I),
    re.compile(r"\bInter\b", re.I),
]

ALLOWED_TOKENS = [
    "--font-allternit-sans",
    "--font-allternit-serif",
    "--font-allternit-mono",
    "--font-ui",
    "--font-research",
    "--font-code",
    "Allternit Sans",
    "Allternit Serif",
    "Allternit Mono",
]

def skip(path: Path) -> bool:
    return (
        path.name in APPROVED_FILES
        or "node_modules" in path.parts
        or ".next" in path.parts
        or "dist" in path.parts
        or "build" in path.parts
    )

def allowed(line: str) -> bool:
    if any(token in line for token in ALLOWED_TOKENS):
        return True
    # Skip TypeScript interface/type property declarations (not actual font usage)
    if re.search(r"^\s*fontFamily\s*:\s*(string|number|boolean|undefined|any)", line):
        return True
    return False

violations = []
for target in TARGETS:
    p = ROOT / target
    if not p.exists():
        continue
    for f in p.rglob("*"):
        if not f.is_file() or f.suffix not in EXTS or skip(f):
            continue
        text = f.read_text(errors="ignore")
        for i, line in enumerate(text.splitlines(), 1):
            if allowed(line):
                continue
            for pat in FORBIDDEN:
                if pat.search(line):
                    violations.append({
                        "file": str(f.relative_to(ROOT)),
                        "line": i,
                        "pattern": pat.pattern,
                        "content": line.strip()[:200]
                    })

if violations:
    print("TYPOGRAPHY VALIDATION: FAIL")
    print(json.dumps({"violations": violations}, indent=2))
    sys.exit(1)

print("TYPOGRAPHY VALIDATION: PASS")
print("No unauthorized typography patterns found.")

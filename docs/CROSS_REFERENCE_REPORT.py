import os, json

base_dir = '/Users/macbook/Desktop/allternit-workspace/allternit'
dag_file = os.path.join(base_dir, 'docs/IMPLEMENTATION_DAG.md')

# Read DAG to find phases
with open(dag_file, 'r') as f:
    dag_content = f.read()

phases = [line for line in dag_content.split('\n') if line.startswith('## ')]

# Find top level functional directories
target_dirs = ['api', 'cmd', 'domains', 'infrastructure', 'packages', 'services', 'surfaces']

inventory = {}
for tdir in target_dirs:
    full_path = os.path.join(base_dir, tdir)
    if os.path.exists(full_path):
        subdirs = [d for d in os.listdir(full_path) if os.path.isdir(os.path.join(full_path, d))]
        inventory[tdir] = sorted(subdirs)

report = "# Codebase vs DAG Cross-Reference Report\n\n"
report += "## The 22 Phases in the DAG\n"
for p in phases:
    report += f"- {p.replace('## ', '')}\n"

report += "\n## Codebase Inventory & Mapping\n"

# A rough dictionary mapping known directories to phases for the report
mapping_guesses = {
    'domains/agent': 'Phase 1 (GizziClaw) / Phase 14 (Agent Runner)',
    'domains/computer-use': 'Phase 13 (Computer Use)',
    'domains/governance': 'Phase 22 (System Law)',
    'domains/kernel': 'Phase 20 (Kernel Sandboxing) / Phase 14 (Rails)',
    'domains/mcp': 'Phase 11 (MCP Apps Integration)',
    'domains/tenants': 'UNKNOWN (Likely Phase 15 Hardening or Unmapped)',
    'services/ai': 'UNKNOWN (Possibly Phase 16 Avatar / Unmapped)',
    'services/computer-use-operator': 'Phase 13 (Computer Use)',
    'services/gateway': 'Phase 13 (Computer Use Gateway)',
    'services/infrastructure': 'Phase 15 (Production Readiness)',
    'services/memory': 'Phase 6 (Memory Promotion) / Phase 17 (Isolation)',
    'services/ml': 'Phase 2 (RLM) / Unmapped',
    'services/operator': 'UNKNOWN',
    'services/orchestration': 'Phase 14 (Agent Runner) / Phase 17 (Mode Sessions)',
    'services/registry': 'Phase 18 (Mini-App Data System)',
    'services/runtime': 'Phase 20 (Kernel Execution)',
    'services/search': 'UNKNOWN (Unmapped Retrieval/Search layer)',
    'services/support': 'UNKNOWN',
    'services/tools': 'Phase 13 (Computer Use)',
    'services/udemy-downloader': 'Phase 21 (Course Publishing)',
    'services/ui': 'Phase 18 (Unified UI)',
    'services/voice': 'UNKNOWN (Voice/Avatar Integration - Unmapped)',
    'surfaces/allternit-platform': 'Phase 16, 17, 18 (UI)',
    'surfaces/allternit-extensions': 'Phase 13 (Browser Extension)',
    'surfaces/platform-electron': 'Phase 13 (Desktop App)',
    'surfaces/thin-client': 'UNKNOWN',
    'api/cloud': 'Phase 15 (Cloud API)',
    'api/gateway': 'Phase 0/1/18 (Routing Gateway)',
    'api/core': 'UNKNOWN',
    'cmd/gizzi-code': 'Phase 1 (GizziClaw) / Phase 8 (TUI)',
    'cmd/cli-typescript': 'UNKNOWN',
    'cmd/launcher': 'UNKNOWN'
}

for tdir, subdirs in inventory.items():
    report += f"\n### `{tdir}/`\n"
    for sd in subdirs:
        if sd in ['.deprecated', 'node_modules', 'target', 'dist', 'build']: continue
        
        path_key = f"{tdir}/{sd}"
        guess = mapping_guesses.get(path_key, "UNKNOWN (Needs mapping)")
        
        # Check if the folder is empty or not
        full_sd_path = os.path.join(base_dir, tdir, sd)
        files = os.listdir(full_sd_path)
        is_empty = " (EMPTY/SCAFFOLD)" if len(files) <= 1 else ""
        
        report += f"- **`{sd}/`**{is_empty} -> *{guess}*\n"

report += "\n## Critical Unmapped Findings\n"
report += "1. **Voice Services:** `services/voice/` exists and is active, but voice integration (TTS/Avatar Voice) is missing from the DAG.\n"
report += "2. **Search/Retrieval:** `services/search/` is missing from the DAG entirely. This usually handles RAG and web search tools.\n"
report += "3. **Tenants:** `domains/tenants/` implies a multi-tenant SaaS architecture which isn't fully detailed in the DAG.\n"
report += "4. **Launcher/Thin-Client:** `cmd/launcher/` and `surfaces/thin-client/` indicate alternative deployment wrappers not explicitly listed.\n"

with open(os.path.join(base_dir, 'docs/CODEBASE_DAG_CROSS_REFERENCE.md'), 'w') as f:
    f.write(report)

print("Cross-reference report generated at docs/CODEBASE_DAG_CROSS_REFERENCE.md")

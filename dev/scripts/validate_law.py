#!/usr/bin/env python3
import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
try:
    from jsonschema import Draft202012Validator, RefResolver
except Exception as exc:  # pragma: no cover - required for deterministic boot
    Draft202012Validator = None
    RefResolver = None

ROOT = Path(__file__).resolve().parents[1]

REQUIRED_FILES = [
    ROOT / "SOT.md",
    ROOT / "CODEBASE.md",
    ROOT / "agent" / "POLICY.md",
    ROOT / "spec" / "AcceptanceTests.md",
    ROOT / "spec" / "Baseline.md",
    ROOT / "spec" / "ADRs" / "ADR-0000-template.md",
    ROOT / "spec" / "Contracts" / "BootManifest.schema.json",
    ROOT / "spec" / "Contracts" / "WIH.schema.json",
    ROOT / "spec" / "Contracts" / "Graph.schema.json",
    ROOT / "spec" / "Contracts" / "ToolRegistry.schema.json",
    ROOT / "spec" / "Contracts" / "ToolDefinition.schema.json",
    ROOT / "spec" / "Contracts" / "Receipt.schema.json",
    ROOT / "spec" / "Contracts" / "WorkerDefinition.schema.json",
    ROOT / "spec" / "Contracts" / "WorkerRegistry.schema.json",
    ROOT / "spec" / "Contracts" / "SubprocessReceipt.schema.json",
    ROOT / "spec" / "Contracts" / "RunState.schema.json",
    ROOT / "spec" / "Contracts" / "BeadsGraph.schema.json",
    ROOT / "spec" / "Contracts" / "BeadsNode.schema.json",
    ROOT / "spec" / "Contracts" / "BeadsRunState.schema.json",
    ROOT / "spec" / "Contracts" / "UIAction.schema.json",
    ROOT / "spec" / "Contracts" / "UIReceipt.schema.json",
    ROOT / "spec" / "Contracts" / "UIWorkspaceLayout.schema.json",
    ROOT / "spec" / "Contracts" / "UINav.schema.json",
    ROOT / "spec" / "Contracts" / "UIRegistry.schema.json",
    ROOT / "spec" / "Contracts" / "CodeEvent.schema.json",
    ROOT / "spec" / "Contracts" / "CodeSession.schema.json",
    ROOT / "spec" / "Contracts" / "CodePlan.schema.json",
    ROOT / "spec" / "Contracts" / "ChangeSet.schema.json",
    ROOT / "spec" / "Contracts" / "PolicyProfile.schema.json",
    ROOT / "spec" / "Contracts" / "Workspace.schema.json",
    ROOT / "spec" / "Contracts" / "EditorAction.schema.json",
    ROOT / "spec" / "Contracts" / "PreviewSession.schema.json",
    ROOT / "spec" / "Contracts" / "RunForensics.schema.json",
    ROOT / "spec" / "Contracts" / "ReplayManifest.schema.json",
    ROOT / "spec" / "Contracts" / "ProvenanceTimeline.schema.json",
    ROOT / "workers" / "worker_registry.json",
    ROOT / "infra" / "gateway" / "gateway_registry.json",
    ROOT / "capsules" / "capsule_registry.json",
    ROOT / "cli" / "cli_registry.json",
    ROOT / "memory" / "promotion_registry.json",
    ROOT / "ui" / "ui_registry.json",
    ROOT / "ui" / "workspace_layout.json",
    ROOT / "ui" / "ui_nav.json",
]

TOOLS_REGISTRY_PATH = ROOT / "tools" / "tool_registry.json"
WORKER_REGISTRY_PATH = ROOT / "workers" / "worker_registry.json"

GRAPH_DIR = ROOT / ".allternit" / "graphs"
WIH_DIR = ROOT / ".allternit" / "wih"
BEADS_GRAPH_DIR = ROOT / ".allternit" / "beads" / "graphs"

ACCEPTANCE_FILE = ROOT / "spec" / "AcceptanceTests.md"

DELTAS_DIR = ROOT / "spec" / "Deltas"

LEGACY_SCAN_DIRS = [
    ROOT / ".github",
    ROOT / "scripts",
    ROOT / "services",
    ROOT / "crates",
    ROOT / "apps",
]

LEGACY_TOKEN = "spec/1_contracts"
MAX_SCAN_BYTES = 2_000_000
ALLOWED_SCAN_EXTS = {
    ".rs",
    ".py",
    ".ts",
    ".tsx",
    ".md",
    ".yml",
    ".yaml",
    ".toml",
    ".json",
    ".sh",
}

GRAPH_SCHEMA_ID = "https://allternit.local/spec/contracts/Graph.schema.json"
WIH_SCHEMA_ID = "https://allternit.local/spec/contracts/WIH.schema.json"
TOOL_REGISTRY_SCHEMA_ID = "https://allternit.local/spec/contracts/ToolRegistry.schema.json"
WORKER_REGISTRY_SCHEMA_ID = "https://allternit.local/spec/contracts/WorkerRegistry.schema.json"
BOOT_MANIFEST_SCHEMA_ID = "https://allternit.local/spec/contracts/BootManifest.schema.json"
BEADS_GRAPH_SCHEMA_ID = "https://allternit.local/spec/contracts/BeadsGraph.schema.json"
UI_REGISTRY_SCHEMA_ID = "https://allternit.local/spec/contracts/UIRegistry.schema.json"
UI_ACTION_SCHEMA_ID = "https://allternit.local/spec/contracts/UIAction.schema.json"
UI_NAV_SCHEMA_ID = "https://allternit.local/spec/contracts/UINav.schema.json"
UI_WORKSPACE_LAYOUT_SCHEMA_ID = "https://allternit.local/spec/contracts/UIWorkspaceLayout.schema.json"
DEFAULT_BOOT_MANIFEST_PATH = ROOT / ".allternit" / "boot" / "boot_manifest.json"


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def load_json(path: Path):
    try:
        return json.loads(path.read_text())
    except Exception as exc:
        fail(f"Invalid JSON in {path}: {exc}")


def collect_acceptance_ids() -> set:
    content = ACCEPTANCE_FILE.read_text()
    # Supports IDs like AT-UI-0001 and multi-segment IDs like AT-CODE-CS-0009.
    return set(re.findall(r"AT-[A-Z0-9]+(?:-[A-Z0-9]+)*-\d{4}", content))


def scan_legacy_refs():
    for base in LEGACY_SCAN_DIRS:
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if not path.is_file():
                continue
            if path.suffix and path.suffix not in ALLOWED_SCAN_EXTS:
                continue
            try:
                if path.stat().st_size > MAX_SCAN_BYTES:
                    continue
            except Exception:
                continue
            if "spec/Deltas" in str(path):
                continue
            if path.name == "validate_law.py":
                continue
            try:
                text = path.read_text(errors="ignore")
            except Exception:
                continue
            if LEGACY_TOKEN in text:
                fail(f"Legacy contract root referenced in {path}")


def ensure_list(value, label):
    if not isinstance(value, list):
        fail(f"{label} must be a list")


def ensure_nonempty_list(value, label):
    ensure_list(value, label)
    if not value:
        fail(f"{label} must be non-empty")


def validate_graph(graph, path: Path):
    for key in ("graph_id", "title", "nodes", "edges"):
        if key not in graph:
            fail(f"Graph missing '{key}' in {path}")
    ensure_list(graph["nodes"], f"{path} nodes")
    ensure_list(graph["edges"], f"{path} edges")
    for node in graph["nodes"]:
        for key in ("task_id", "title", "blocked_by", "wih_path"):
            if key not in node:
                fail(f"Graph node missing '{key}' in {path}")
        ensure_list(node["blocked_by"], f"{path} node.blocked_by")
        if not str(node["wih_path"]).startswith("/.allternit/wih/"):
            fail(f"Invalid wih_path in {path}: {node['wih_path']}")


def validate_wih(wih, path: Path):
    required = [
        "wih_version",
        "task_id",
        "graph_id",
        "title",
        "blocked_by",
        "outputs",
        "write_scope",
        "tools",
        "memory",
        "acceptance",
        "beads",
    ]
    for key in required:
        if key not in wih:
            fail(f"WIH missing '{key}' in {path}")
    ensure_list(wih["blocked_by"], f"{path} blocked_by")

    outputs = wih.get("outputs", {})
    ensure_nonempty_list(outputs.get("required_artifacts"), f"{path} outputs.required_artifacts")
    ensure_nonempty_list(outputs.get("artifact_paths"), f"{path} outputs.artifact_paths")

    write_scope = wih.get("write_scope", {})
    if write_scope.get("root") != "/.allternit/":
        fail(f"WIH write_scope.root must be '/.allternit/' in {path}")
    ensure_nonempty_list(write_scope.get("allowed_globs"), f"{path} write_scope.allowed_globs")

    tools = wih.get("tools", {})
    ensure_nonempty_list(tools.get("allowlist"), f"{path} tools.allowlist")

    memory = wih.get("memory", {})
    ensure_nonempty_list(memory.get("packs"), f"{path} memory.packs")

    acceptance = wih.get("acceptance", {})
    ensure_nonempty_list(acceptance.get("checks"), f"{path} acceptance.checks")

    beads = wih.get("beads")
    if not isinstance(beads, dict):
        fail(f"WIH beads envelope missing or invalid in {path}")
    for key in ("task_id", "graph_id", "blocked_by"):
        if beads.get(key) != wih.get(key):
            fail(f"WIH beads.{key} mismatch in {path}")
    if beads.get("write_scope") != wih.get("write_scope"):
        fail(f"WIH beads.write_scope mismatch in {path}")
    if beads.get("tools") != wih.get("tools"):
        fail(f"WIH beads.tools mismatch in {path}")
    if beads.get("acceptance") != wih.get("acceptance"):
        fail(f"WIH beads.acceptance mismatch in {path}")


def validate_tool_registry(registry, path: Path):
    if "version" not in registry:
        fail(f"Tool registry missing version in {path}")
    tools = registry.get("tools")
    ensure_nonempty_list(tools, f"{path} tools")
    for tool in tools:
        for key in (
            "id",
            "title",
            "kind",
            "safety_level",
            "entrypoint",
            "inputs_schema",
            "outputs_schema",
        ):
            if key not in tool:
                fail(f"Tool registry entry missing '{key}' in {path}")


def validate_worker_registry(registry, path: Path):
    if "version" not in registry:
        fail(f"Worker registry missing version in {path}")
    workers = registry.get("workers")
    ensure_nonempty_list(workers, f"{path} workers")
    seen = set()
    for worker in workers:
        worker_id = worker.get("worker_id")
        if not worker_id:
            fail(f"Worker registry entry missing worker_id in {path}")
        if worker_id in seen:
            fail(f"Duplicate worker_id '{worker_id}' in {path}")
        seen.add(worker_id)

        command = worker.get("command", "")
        if " " in command.strip():
            fail(f"Worker command must not contain spaces in {path}: {worker_id}")
        if command.endswith("bash") or command.endswith("/bash") or command.endswith("sh") or command.endswith("/sh"):
            fail(f"Worker command cannot be a shell in {path}: {worker_id}")

        fs_policy = worker.get("fs_policy", {})
        if fs_policy.get("must_be_run_scoped") is not True:
            fail(f"Worker fs_policy.must_be_run_scoped must be true in {path}: {worker_id}")
        roots = fs_policy.get("allowed_output_roots", [])
        ensure_nonempty_list(roots, f"{path} fs_policy.allowed_output_roots")
        for root in roots:
            if not str(root).startswith("/.allternit/"):
                fail(f"Worker allowed_output_roots must be under /.allternit/ in {path}: {worker_id}")


def validate_ui_registry(registry, path: Path):
    if "version" not in registry:
        fail(f"UI registry missing version in {path}")

    ui_actions = registry.get("ui_actions", [])
    ensure_nonempty_list(ui_actions, f"{path} ui_actions")
    action_ids = set()

    for action in ui_actions:
        action_id = action.get("action_id")
        if not action_id:
            fail(f"UI action missing action_id in {path}")
        if action_id in action_ids:
            fail(f"Duplicate action_id '{action_id}' in {path}")
        action_ids.add(action_id)

        required_fields = ["name", "description", "gateway_route", "allowed_methods", "requires_auth"]
        for field in required_fields:
            if field not in action:
                fail(f"UI action '{action_id}' missing '{field}' in {path}")

        # Validate gateway route format (METHOD:/path)
        gateway_route = action.get("gateway_route", "")
        if ":" not in gateway_route:
            fail(f"UI action '{action_id}' has invalid gateway_route format '{gateway_route}' in {path}")

        parts = gateway_route.split(":", 1)
        if len(parts) != 2:
            fail(f"UI action '{action_id}' has invalid gateway_route format '{gateway_route}' in {path}")

        method, path_suffix = parts[0], parts[1]

        # Validate method
        valid_methods = {"GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"}
        if method not in valid_methods:
            fail(f"UI action '{action_id}' has invalid HTTP method '{method}' in {path}")

        # Validate allowed methods
        allowed_methods = action.get("allowed_methods", [])
        ensure_nonempty_list(allowed_methods, f"{path} allowed_methods for action {action_id}")
        for method in allowed_methods:
            if method not in valid_methods:
                fail(f"UI action '{action_id}' has invalid allowed method '{method}' in {path}")


def validate_ui_contracts(schemas: dict):
    ui_registry_path = ROOT / "ui" / "ui_registry.json"
    ui_registry = load_json(ui_registry_path)
    validate_instance(ui_registry, UI_REGISTRY_SCHEMA_ID, schemas, str(ui_registry_path))
    validate_ui_registry(ui_registry, ui_registry_path)

    # AT-UI-0005: Registry actions must be representable as valid UIAction envelopes.
    for action in ui_registry.get("ui_actions", []):
        action_envelope = {
            "action_version": ui_registry.get("version", "v0.1"),
            "action_id": action.get("action_id"),
            "gateway_route": action.get("gateway_route"),
            "run_id": "validation-run",
            "wih_id": "validation-wih",
            "payload": {},
            "timestamp": "2026-01-01T00:00:00Z",
            "source": "registry_validation",
            "session_id": "validation-session",
            "user_id": "validation-user",
        }
        validate_instance(
            action_envelope,
            UI_ACTION_SCHEMA_ID,
            schemas,
            f"{ui_registry_path} action {action.get('action_id')}",
        )

    ui_nav_path = ROOT / "ui" / "ui_nav.json"
    ui_nav = load_json(ui_nav_path)
    validate_instance(ui_nav, UI_NAV_SCHEMA_ID, schemas, str(ui_nav_path))

    workspace_layout_path = ROOT / "ui" / "workspace_layout.json"
    workspace_layout = load_json(workspace_layout_path)
    validate_instance(
        workspace_layout,
        UI_WORKSPACE_LAYOUT_SCHEMA_ID,
        schemas,
        str(workspace_layout_path),
    )


def validate_instance(instance, schema_id: str, schemas: dict, label: str):
    if Draft202012Validator is None or RefResolver is None:
        fail("jsonschema dependency missing. Install with: python3 -m pip install -r scripts/requirements.txt")
    schema = schemas.get(schema_id)
    if not schema:
        fail(f"Missing schema {schema_id} for {label}")
    resolver = RefResolver.from_schema(schema, store=schemas)
    validator = Draft202012Validator(schema, resolver=resolver)
    errors = sorted(validator.iter_errors(instance), key=lambda e: list(e.path))
    if errors:
        err = errors[0]
        path = "/".join(str(p) for p in err.path) if err.path else "(root)"
        fail(f"Schema validation failed for {label} at {path}: {err.message}")


def validate_boot_manifest(manifest_path: Path, schemas: dict):
    if not manifest_path.exists():
        fail(f"Boot manifest missing: {manifest_path}")
    manifest = load_json(manifest_path)
    validate_instance(manifest, BOOT_MANIFEST_SCHEMA_ID, schemas, str(manifest_path))
def validate_schema_files():
    contracts_dir = ROOT / "spec" / "Contracts"
    schema_files = list(contracts_dir.glob("*.schema.json"))
    if not schema_files:
        fail("No schema files found in spec/Contracts")
    if Draft202012Validator is None:
        fail("jsonschema dependency missing. Install with: python3 -m pip install -r scripts/requirements.txt")

    schemas = {}
    for schema_path in schema_files:
        schema = load_json(schema_path)
        if "$schema" not in schema:
            fail(f"Schema missing $schema in {schema_path}")
        schema_id = schema.get("$id")
        if not schema_id:
            fail(f"Schema missing $id in {schema_path}")
        if schema_id in schemas:
            fail(f"Duplicate schema $id {schema_id} in {schema_path}")
        try:
            Draft202012Validator.check_schema(schema)
        except Exception as exc:
            fail(f"Invalid JSON Schema in {schema_path}: {exc}")
        schemas[schema_id] = schema
    return schemas


def ensure_deltas_present():
    if not DELTAS_DIR.exists():
        fail("Missing spec/Deltas directory")
    has_delta = any(path.suffix == ".md" for path in DELTAS_DIR.iterdir())
    if not has_delta:
        fail("spec/Deltas has no .md files")


def validate_graph_semantics(graph, path: Path, wih_by_path: dict):
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    graph_id = graph.get("graph_id")

    node_ids = []
    for node in nodes:
        task_id = node.get("task_id")
        if not task_id:
            fail(f"Graph node missing task_id in {path}")
        if task_id in node_ids:
            fail(f"Duplicate task_id '{task_id}' in {path}")
        node_ids.append(task_id)

    node_set = set(node_ids)
    inbound = {node_id: set() for node_id in node_set}
    adjacency = {node_id: set() for node_id in node_set}
    indegree = {node_id: 0 for node_id in node_set}

    for edge in edges:
        src = edge.get("from")
        dst = edge.get("to")
        if src not in node_set or dst not in node_set:
            fail(f"Edge references missing node in {path}: {src} -> {dst}")
        if src == dst:
            fail(f"Self-referential edge in {path}: {src} -> {dst}")
        if dst not in adjacency[src]:
            adjacency[src].add(dst)
            indegree[dst] += 1
            inbound[dst].add(src)

    queue = [node_id for node_id, deg in indegree.items() if deg == 0]
    visited = 0
    while queue:
        current = queue.pop()
        visited += 1
        for nxt in adjacency[current]:
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                queue.append(nxt)

    if visited != len(node_set):
        fail(f"Graph contains cycle(s) in {path}")

    for node in nodes:
        task_id = node["task_id"]
        blocked_by = set(node.get("blocked_by", []))
        inbound_blocked = inbound.get(task_id, set())
        if blocked_by != inbound_blocked:
            fail(
                f"blocked_by mismatch in {path} for {task_id}: "
                f"node={sorted(blocked_by)} edges={sorted(inbound_blocked)}"
            )
        wih_path = node.get("wih_path")
        if not wih_path:
            fail(f"Graph node missing wih_path in {path}")
        wih = wih_by_path.get(wih_path)
        if not wih:
            fail(f"Missing WIH {wih_path} referenced by {path}")
        if wih.get("task_id") != task_id:
            fail(f"WIH task_id mismatch for {wih_path} in {path}")
        if wih.get("graph_id") != graph_id:
            fail(f"WIH graph_id mismatch for {wih_path} in {path}")
        wih_blocked = set(wih.get("blocked_by", []))
        if wih_blocked != blocked_by:
            fail(
                f"blocked_by mismatch between WIH and graph for {task_id}: "
                f"wih={sorted(wih_blocked)} graph={sorted(blocked_by)}"
            )


def normalize_graph_for_compare(graph):
    nodes = []
    for node in graph.get("nodes", []):
        nodes.append(
            {
                "task_id": node.get("task_id"),
                "title": node.get("title"),
                "blocked_by": sorted(node.get("blocked_by", [])),
                "wih_path": node.get("wih_path"),
            }
        )
    edges = []
    for edge in graph.get("edges", []):
        edges.append({"from": edge.get("from"), "to": edge.get("to")})
    return {
        "graph_id": graph.get("graph_id"),
        "title": graph.get("title"),
        "nodes": sorted(nodes, key=lambda n: n["task_id"] or ""),
        "edges": sorted(edges, key=lambda e: (e["from"] or "", e["to"] or "")),
    }

def write_beacon():
    boot_dir = ROOT / ".allternit" / "boot"
    boot_dir.mkdir(parents=True, exist_ok=True)
    beacon_path = boot_dir / "validator.json"
    beacon = {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "validator": "scripts/validate_law.py",
    }
    beacon_path.write_text(json.dumps(beacon, indent=2))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--emit-beacon", action="store_true")
    parser.add_argument("--validate-boot-manifest", action="store_true")
    parser.add_argument("--boot-manifest-path", default=str(DEFAULT_BOOT_MANIFEST_PATH))
    args = parser.parse_args()

    missing = [str(p) for p in REQUIRED_FILES if not p.exists()]
    if missing:
        fail(f"Missing required anchors: {', '.join(missing)}")

    ensure_deltas_present()
    schemas = validate_schema_files()

    if not GRAPH_DIR.exists() or not any(GRAPH_DIR.glob("*.json")):
        fail("Missing .allternit/graphs/*.json")
    if not WIH_DIR.exists() or not any(WIH_DIR.glob("*.json")):
        fail("Missing .allternit/wih/*.json")
    if not BEADS_GRAPH_DIR.exists() or not any(BEADS_GRAPH_DIR.glob("*.json")):
        fail("Missing .allternit/beads/graphs/*.json")

    if not TOOLS_REGISTRY_PATH.exists():
        fail("Missing tools/tool_registry.json")

    registry = load_json(TOOLS_REGISTRY_PATH)
    validate_instance(registry, TOOL_REGISTRY_SCHEMA_ID, schemas, "tools/tool_registry.json")
    validate_tool_registry(registry, TOOLS_REGISTRY_PATH)
    registry_ids = {tool["id"] for tool in registry.get("tools", [])}

    worker_registry = load_json(WORKER_REGISTRY_PATH)
    validate_instance(worker_registry, WORKER_REGISTRY_SCHEMA_ID, schemas, "workers/worker_registry.json")
    validate_worker_registry(worker_registry, WORKER_REGISTRY_PATH)

    validate_ui_contracts(schemas)

    acceptance_ids = collect_acceptance_ids()

    wih_by_path = {}
    for wih_path in WIH_DIR.glob("*.json"):
        wih = load_json(wih_path)
        validate_instance(wih, WIH_SCHEMA_ID, schemas, str(wih_path))
        validate_wih(wih, wih_path)

        acceptance = wih.get("acceptance", {}).get("checks", [])
        for check in acceptance:
            if check not in acceptance_ids:
                fail(f"Unknown acceptance id '{check}' in {wih_path}")

        allowlist = wih.get("tools", {}).get("allowlist", [])
        for tool_id in allowlist:
            if tool_id not in registry_ids:
                fail(f"Tool '{tool_id}' in {wih_path} missing from tool registry")

        canonical = "/" + str(wih_path.relative_to(ROOT)).replace("\\", "/")
        wih_by_path[canonical] = wih

    graph_by_id = {}
    for graph_path in GRAPH_DIR.glob("*.json"):
        graph = load_json(graph_path)
        validate_instance(graph, GRAPH_SCHEMA_ID, schemas, str(graph_path))
        validate_graph(graph, graph_path)
        validate_graph_semantics(graph, graph_path, wih_by_path)
        graph_id = graph.get("graph_id")
        if graph_id in graph_by_id:
            fail(f"Duplicate graph_id {graph_id} in {graph_path}")
        graph_by_id[graph_id] = graph

    for beads_graph_path in BEADS_GRAPH_DIR.glob("*.json"):
        beads_graph = load_json(beads_graph_path)
        validate_instance(beads_graph, BEADS_GRAPH_SCHEMA_ID, schemas, str(beads_graph_path))
        beads_id = beads_graph.get("graph_id")
        if beads_id not in graph_by_id:
            fail(f"Beads graph {beads_id} missing matching graph in .allternit/graphs")
        base_graph = graph_by_id[beads_id]
        if normalize_graph_for_compare(beads_graph) != normalize_graph_for_compare(base_graph):
            fail(f"Beads graph {beads_id} inconsistent with graph definition")

    scan_legacy_refs()

    if args.validate_boot_manifest:
        validate_boot_manifest(Path(args.boot_manifest_path), schemas)

    if args.emit_beacon:
        write_beacon()

    print("OK: law validation passed")


if __name__ == "__main__":
    main()

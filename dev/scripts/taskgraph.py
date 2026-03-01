#!/usr/bin/env python3
import argparse
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GRAPH_DIR = ROOT / ".a2r" / "graphs"
WIH_DIR = ROOT / ".a2r" / "wih"
RUN_STATE_DIR = ROOT / ".a2r" / "run_state"
RECEIPTS_DIR = ROOT / ".a2r" / "receipts"
ARTIFACTS_DIR = ROOT / ".a2r" / "artifacts"

BEADS_KEYS = [
    "wih_version",
    "task_id",
    "graph_id",
    "title",
    "blocked_by",
    "write_scope",
    "tools",
    "acceptance",
]

AGENT_PROFILES_PATH = ROOT / "agent" / "agent_profiles.json"

NODE_STATUS_PENDING = "PENDING"
NODE_STATUS_BLOCKED = "BLOCKED"
NODE_STATUS_RUNNING = "RUNNING"
NODE_STATUS_SUCCEEDED = "SUCCEEDED"
NODE_STATUS_FAILED = "FAILED"
NODE_STATUS_SKIPPED = "SKIPPED"


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    sys.exit(1)


def load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text())
    except Exception as exc:
        fail(f"Failed to read {path}: {exc}")


def load_graph(graph_id: str) -> dict:
    graph_path = GRAPH_DIR / f"{graph_id}.json"
    if not graph_path.exists():
        fail(f"Graph not found: {graph_path}")
    graph = load_json(graph_path)
    if graph.get("graph_id") != graph_id:
        fail(f"Graph id mismatch in {graph_path}")
    return graph


def load_wih(wih_path: str) -> dict:
    rel_path = wih_path.lstrip("/")
    path = ROOT / rel_path
    if not path.exists():
        fail(f"WIH not found: {path}")
    return load_json(path)


def load_agent_profiles() -> set[str]:
    profiles = load_json(AGENT_PROFILES_PATH)
    items = profiles.get("profiles", [])
    if not items:
        fail("Agent profiles list is empty")
    ids = set()
    for profile in items:
        pid = profile.get("id")
        if not pid:
            fail("Agent profile missing id")
        ids.add(pid)
    return ids


def require_agent_profile(agent_profile_id: str) -> None:
    profiles = load_agent_profiles()
    if agent_profile_id not in profiles:
        fail(f"Unknown agent profile: {agent_profile_id}")


def validate_wih_node(node: dict, wih: dict, graph_id: str) -> None:
    if wih.get("task_id") != node.get("task_id"):
        fail(f"WIH task_id mismatch for {node.get('task_id')}")
    if wih.get("graph_id") != graph_id:
        fail(f"WIH graph_id mismatch for {node.get('task_id')}")

    graph_blocked = node.get("blocked_by", [])
    wih_blocked = wih.get("blocked_by", [])
    if graph_blocked != wih_blocked:
        fail(f"blocked_by mismatch for {node.get('task_id')}")

    beads = wih.get("beads")
    if not isinstance(beads, dict):
        fail(f"Beads envelope missing for {node.get('task_id')}")

    for key in BEADS_KEYS:
        if beads.get(key) != wih.get(key):
            fail(f"Beads.{key} mismatch for {node.get('task_id')}")


def install_run(graph_id: str, agent_profile_id: str) -> dict:
    require_agent_profile(agent_profile_id)
    graph = load_graph(graph_id)
    nodes = graph.get("nodes", [])
    if not nodes:
        fail(f"Graph has no nodes: {graph_id}")

    for node in nodes:
        wih = load_wih(node.get("wih_path", ""))
        validate_wih_node(node, wih, graph_id)

    run_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    node_states = []
    runnable = []
    for node in nodes:
        blocked = node.get("blocked_by", [])
        status = NODE_STATUS_BLOCKED if blocked else NODE_STATUS_PENDING
        if status == NODE_STATUS_PENDING:
            runnable.append(node.get("task_id"))
        node_states.append({
            "task_id": node.get("task_id"),
            "status": status,
            "last_receipt_id": ""
        })

    run_state = {
        "run_id": run_id,
        "graph_id": graph_id,
        "status": "RUNNING",
        "started_at": now,
        "node_states": node_states,
        "resume_cursor": {
            "last_node": "",
            "next_nodes": sorted(runnable)
        },
        "receipts": [],
        "artifacts": []
    }

    RUN_STATE_DIR.mkdir(parents=True, exist_ok=True)
    run_path = RUN_STATE_DIR / f"{run_id}.json"
    run_path.write_text(json.dumps(run_state, indent=2))
    write_agent_execution_receipt(
        run_id,
        graph_id,
        agent_profile_id,
        "INSTALLED",
        run_path,
    )

    return {
        "run_id": run_id,
        "graph_id": graph_id,
        "run_state_path": str(run_path)
    }


def resume_run(run_id: str, agent_profile_id: str) -> dict:
    require_agent_profile(agent_profile_id)
    run_path = RUN_STATE_DIR / f"{run_id}.json"
    if not run_path.exists():
        fail(f"Run state not found: {run_path}")
    run_state = load_json(run_path)

    graph_id = run_state.get("graph_id")
    if not graph_id:
        fail(f"Run state missing graph_id: {run_path}")

    graph = load_graph(graph_id)
    nodes = graph.get("nodes", [])
    if not nodes:
        fail(f"Graph has no nodes: {graph_id}")

    node_states = run_state.get("node_states", [])
    state_by_task = {state.get("task_id"): state for state in node_states}
    for node in nodes:
        task_id = node.get("task_id")
        if task_id not in state_by_task:
            fail(f"Run state missing node state for {task_id}")

        wih = load_wih(node.get("wih_path", ""))
        validate_wih_node(node, wih, graph_id)

    receipt_dir = RECEIPTS_DIR / run_id
    receipt_nodes = set()
    receipt_ids = []
    if receipt_dir.exists():
        for receipt_path in receipt_dir.glob("*.json"):
            receipt = load_json(receipt_path)
            receipt_run_id = receipt.get("run_id")
            if receipt_run_id and receipt_run_id != run_id:
                fail(f"Receipt run_id mismatch in {receipt_path}")
            node_id = receipt.get("node_id") or receipt.get("task_id")
            if node_id:
                receipt_nodes.add(node_id)
            receipt_id = receipt.get("receipt_id") or receipt_path.stem
            receipt_ids.append(receipt_id)

    for state in node_states:
        if state.get("status") == NODE_STATUS_SUCCEEDED:
            if state.get("task_id") not in receipt_nodes:
                fail(f"Missing receipt for completed node {state.get('task_id')}")

    runnable = []
    for node in nodes:
        task_id = node.get("task_id")
        state = state_by_task.get(task_id, {})
        status = state.get("status")
        if status in [NODE_STATUS_SUCCEEDED, NODE_STATUS_FAILED, NODE_STATUS_SKIPPED]:
            continue

        deps = node.get("blocked_by", [])
        deps_missing = [dep for dep in deps if dep not in receipt_nodes]
        if deps_missing:
            if status == NODE_STATUS_RUNNING:
                fail(f"Node {task_id} running without dependency receipts")
            state["status"] = NODE_STATUS_BLOCKED
            continue

        if status == NODE_STATUS_BLOCKED:
            state["status"] = NODE_STATUS_PENDING
        if state["status"] == NODE_STATUS_PENDING:
            runnable.append(task_id)

    run_state["receipts"] = sorted(receipt_ids)
    run_state["resume_cursor"] = {
        "last_node": run_state.get("resume_cursor", {}).get("last_node", ""),
        "next_nodes": sorted(runnable)
    }

    run_path.write_text(json.dumps(run_state, indent=2))
    write_agent_execution_receipt(
        run_id,
        graph_id,
        agent_profile_id,
        "RESUMED",
        run_path,
    )

    return {
        "run_id": run_id,
        "graph_id": graph_id,
        "next_nodes": sorted(runnable)
    }


def write_agent_execution_receipt(
    run_id: str,
    graph_id: str,
    agent_profile_id: str,
    status: str,
    run_path: Path,
) -> None:
    receipt_id = f"agent-exec-{uuid.uuid4()}"
    created_at = datetime.now(timezone.utc).isoformat()
    receipts_dir = RECEIPTS_DIR / run_id
    receipts_dir.mkdir(parents=True, exist_ok=True)
    receipt = {
        "receipt_id": receipt_id,
        "created_at": created_at,
        "run_id": run_id,
        "graph_id": graph_id,
        "agent_profile_id": agent_profile_id,
        "status": status,
        "run_state_path": f"/{run_path.as_posix()}",
        "receipts_dir": f"/{receipts_dir.as_posix()}",
        "artifacts_dir": f"/{(ARTIFACTS_DIR / run_id).as_posix()}",
        "node_receipts": [],
        "tool_receipts": [],
        "subprocess_receipts": [],
    }
    (receipts_dir / f"{receipt_id}.json").write_text(json.dumps(receipt, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description="A2R task graph runner")
    sub = parser.add_subparsers(dest="command", required=True)

    install_parser = sub.add_parser("install", help="Create run_state for a graph")
    install_parser.add_argument("graph_id")
    install_parser.add_argument("--agent-profile", default="kernel-default")

    resume_parser = sub.add_parser("resume", help="Resume a run")
    resume_parser.add_argument("run_id")
    resume_parser.add_argument("--agent-profile", default="kernel-default")

    args = parser.parse_args()

    if args.command == "install":
        result = install_run(args.graph_id, args.agent_profile)
        print(json.dumps(result, indent=2))
        return

    if args.command == "resume":
        result = resume_run(args.run_id, args.agent_profile)
        print(json.dumps(result, indent=2))
        return

    fail("Unknown command")


if __name__ == "__main__":
    main()

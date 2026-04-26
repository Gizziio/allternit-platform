#!/usr/bin/env python3
"""
Replay a run based on forensics data.

This script takes a run forensics export and attempts to reproduce
the same execution sequence and results.
"""

import argparse
import json
import os
from pathlib import Path
from datetime import datetime
import sys
from typing import Dict, List, Any, Optional


def load_json_file(filepath: Path) -> Any:
    """Load JSON file with error handling."""
    try:
        return json.loads(filepath.read_text())
    except Exception as e:
        print(f"ERROR: Failed to load JSON file {filepath}: {e}", file=sys.stderr)
        return None


def validate_replay_prerequisites(original_run_data: Dict[str, Any]) -> bool:
    """Validate that all prerequisites for replay are met."""
    # Check if all required receipts exist
    receipt_paths = original_run_data.get("receipt_collection", {}).get("receipt_paths", [])
    for receipt_path in receipt_paths:
        path = Path(receipt_path)
        if not path.exists():
            print(f"ERROR: Required receipt file does not exist: {receipt_path}", file=sys.stderr)
            return False
    
    # Check if graph exists
    graph_id = original_run_data.get("graph_id", "")
    graph_path = Path(f"/.allternit/graphs/{graph_id}.json")
    if not graph_path.exists():
        print(f"ERROR: Required graph file does not exist: {graph_path}", file=sys.stderr)
        return False
    
    return True


def build_replay_manifest(original_run_data: Dict[str, Any], replay_config: Dict[str, Any]) -> Dict[str, Any]:
    """Build a replay manifest from the original run data."""
    # Extract node execution order from original run
    node_executions = original_run_data.get("node_executions", [])
    execution_order = []
    
    for idx, node in enumerate(node_executions):
        execution_order.append({
            "task_id": node.get("task_id", ""),
            "expected_dependencies": node.get("dependencies", []),
            "execution_sequence_number": idx
        })
    
    # Build the manifest
    manifest = {
        "manifest_version": "v0.1",
        "replay_id": f"replay-{original_run_data['run_id']}-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}",
        "original_run_id": original_run_data["run_id"],
        "replay_timestamp": datetime.utcnow().isoformat() + "Z",
        "replayer_id": "replay_run.py",
        "graph_id": original_run_data["graph_id"],
        "replay_mode": replay_config.get("mode", "FULL"),
        "replay_config": {
            "preserve_original_timestamps": replay_config.get("preserve_timestamps", False),
            "simulate_delays": replay_config.get("simulate_delays", False),
            "dry_run": replay_config.get("dry_run", False),
            "parallel_execution": replay_config.get("parallel_execution", False)
        },
        "node_execution_order": execution_order,
        "memory_state_snapshot": original_run_data.get("memory_state", {}),
        "expected_receipts": original_run_data.get("receipt_collection", {}).get("receipt_paths", []),
        "verification_strategy": {
            "hash_comparison": True,
            "signature_verification": True,
            "semantic_equivalence": True
        }
    }
    
    # Add starting node if partial replay
    if replay_config.get("mode") != "FULL" and replay_config.get("starting_node"):
        manifest["starting_node"] = replay_config["starting_node"]
    
    # Add selected nodes if selective replay
    if replay_config.get("mode") == "SELECTIVE_NODES" and replay_config.get("selected_nodes"):
        manifest["selected_nodes"] = replay_config["selected_nodes"]
    
    return manifest


def execute_replay(manifest: Dict[str, Any]) -> bool:
    """Execute the replay based on the manifest."""
    print(f"Starting replay: {manifest['replay_id']}")
    print(f"Original run: {manifest['original_run_id']}")
    print(f"Graph: {manifest['graph_id']}")
    print(f"Mode: {manifest['replay_mode']}")
    
    # In a real implementation, this would:
    # 1. Load the graph
    # 2. Initialize run state
    # 3. Execute nodes in the specified order
    # 4. Verify receipts match expected
    
    # For now, just simulate the process
    print("Simulating replay execution...")
    
    for node in manifest["node_execution_order"]:
        task_id = node["task_id"]
        print(f"  Executing node: {task_id}")
        
        # In a real implementation, this would actually execute the node
        # and verify the results match expectations
        
    print("Replay execution completed.")
    return True


def replay_run_from_forensics(forensics_path: str, replay_config: Dict[str, Any], output_path: str) -> bool:
    """Replay a run from forensics data."""
    print(f"Loading forensics data from: {forensics_path}")
    
    # Load forensics data
    original_run_data = load_json_file(Path(forensics_path))
    if not original_run_data:
        print(f"ERROR: Could not load forensics data from {forensics_path}", file=sys.stderr)
        return False
    
    # Validate prerequisites
    if not validate_replay_prerequisites(original_run_data):
        print("ERROR: Prerequisites for replay not met", file=sys.stderr)
        return False
    
    # Build replay manifest
    print("Building replay manifest...")
    manifest = build_replay_manifest(original_run_data, replay_config)
    
    # Write manifest to file
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(json.dumps(manifest, indent=2))
    print(f"Replay manifest saved to: {output_path}")
    
    # Execute replay if not dry run
    if not replay_config.get("dry_run", False):
        print("Executing replay...")
        success = execute_replay(manifest)
        if success:
            print("Replay completed successfully!")
        else:
            print("Replay failed!")
        return success
    else:
        print("Dry run completed - replay not executed")
        return True


def main():
    parser = argparse.ArgumentParser(description="Replay a run from forensics data")
    parser.add_argument("forensics_path", help="Path to the forensics export file")
    parser.add_argument("-o", "--output", required=True, help="Output file path for the replay manifest")
    parser.add_argument("--mode", choices=["FULL", "FROM_NODE", "SELECTIVE_NODES"], default="FULL", help="Replay mode")
    parser.add_argument("--starting-node", help="Starting node for partial replay (requires FROM_NODE mode)")
    parser.add_argument("--selected-nodes", nargs="+", help="Selected nodes for selective replay (requires SELECTIVE_NODES mode)")
    parser.add_argument("--preserve-timestamps", action="store_true", help="Preserve original timestamps")
    parser.add_argument("--simulate-delays", action="store_true", help="Simulate original delays")
    parser.add_argument("--dry-run", action="store_true", help="Perform a dry run without executing")
    parser.add_argument("--parallel-execution", action="store_true", help="Allow parallel execution")
    
    args = parser.parse_args()
    
    # Validate arguments
    if args.mode == "FROM_NODE" and not args.starting_node:
        print("ERROR: --starting-node is required when using FROM_NODE mode", file=sys.stderr)
        sys.exit(1)
    
    if args.mode == "SELECTIVE_NODES" and not args.selected_nodes:
        print("ERROR: --selected-nodes is required when using SELECTIVE_NODES mode", file=sys.stderr)
        sys.exit(1)
    
    # Build replay config
    replay_config = {
        "mode": args.mode,
        "starting_node": args.starting_node,
        "selected_nodes": args.selected_nodes,
        "preserve_timestamps": args.preserve_timestamps,
        "simulate_delays": args.simulate_delays,
        "dry_run": args.dry_run,
        "parallel_execution": args.parallel_execution
    }
    
    success = replay_run_from_forensics(args.forensics_path, replay_config, args.output)
    if not success:
        sys.exit(1)


if __name__ == "__main__":
    main()
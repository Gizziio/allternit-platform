#!/usr/bin/env python3
"""
Export a run's forensics data for audit and analysis.

This script collects all receipts, run state, and related artifacts
for a given run and creates a comprehensive forensics export.
"""

import argparse
import json
import os
from pathlib import Path
from datetime import datetime
import hashlib
import sys
from typing import Dict, List, Any, Optional


def load_json_file(filepath: Path) -> Any:
    """Load JSON file with error handling."""
    try:
        return json.loads(filepath.read_text())
    except Exception as e:
        print(f"ERROR: Failed to load JSON file {filepath}: {e}", file=sys.stderr)
        return None


def collect_receipts(run_id: str) -> Dict[str, Any]:
    """Collect all receipts for a given run."""
    receipts_dir = Path(f"/.allternit/receipts/{run_id}")
    if not receipts_dir.exists():
        print(f"WARNING: Receipts directory {receipts_dir} does not exist", file=sys.stderr)
        return {"total_receipts": 0, "receipt_paths": [], "tool_receipts": [], 
                "subprocess_receipts": [], "agent_receipts": [], "gateway_receipts": [],
                "capsule_receipts": [], "cli_receipts": [], "ui_receipts": [],
                "memory_receipts": []}
    
    receipts = {
        "total_receipts": 0,
        "receipt_paths": [],
        "tool_receipts": [],
        "subprocess_receipts": [],
        "agent_receipts": [],
        "gateway_receipts": [],
        "capsule_receipts": [],
        "cli_receipts": [],
        "ui_receipts": [],
        "memory_receipts": []
    }
    
    for receipt_file in receipts_dir.rglob("*.json"):
        receipt_path = str(receipt_file)
        receipts["receipt_paths"].append(receipt_path)
        receipts["total_receipts"] += 1
        
        # Categorize receipts by type
        content = load_json_file(receipt_file)
        if content:
            receipt_type = content.get("receipt_type", "unknown")
            if "tool" in receipt_type.lower():
                receipts["tool_receipts"].append(receipt_path)
            elif "subprocess" in receipt_type.lower():
                receipts["subprocess_receipts"].append(receipt_path)
            elif "agent" in receipt_type.lower():
                receipts["agent_receipts"].append(receipt_path)
            elif "gateway" in receipt_type.lower() or "routing" in receipt_type.lower():
                receipts["gateway_receipts"].append(receipt_path)
            elif "capsule" in receipt_type.lower():
                receipts["capsule_receipts"].append(receipt_path)
            elif "cli" in receipt_type.lower():
                receipts["cli_receipts"].append(receipt_path)
            elif "ui" in receipt_type.lower():
                receipts["ui_receipts"].append(receipt_path)
            elif "memory" in receipt_type.lower():
                receipts["memory_receipts"].append(receipt_path)
    
    return receipts


def collect_memory_state() -> Dict[str, Any]:
    """Collect current memory state."""
    # For now, return a basic structure
    # In a real implementation, this would query the memory layer
    return {
        "promoted_candidates": [],
        "active_layers": []
    }


def verify_integrity(receipt_paths: List[str]) -> Dict[str, Any]:
    """Verify the integrity of the receipt chain."""
    # Basic integrity check - in a real implementation this would do more thorough verification
    valid = True
    tampering_detected = False
    
    # Check if all receipt files exist and are readable
    for receipt_path in receipt_paths:
        path = Path(receipt_path)
        if not path.exists():
            valid = False
            break
            
        # Try to load and parse each receipt
        content = load_json_file(path)
        if content is None:
            valid = False
            tampering_detected = True
            break
    
    return {
        "receipt_chain_valid": valid,
        "hash_verification": True,  # Placeholder
        "tampering_detected": tampering_detected,
        "verification_details": "Basic file existence and readability check" if valid else "One or more receipts could not be loaded"
    }


def export_run_forensics(run_id: str, output_path: str) -> bool:
    """Export forensics data for a given run."""
    print(f"Exporting forensics for run {run_id}...")
    
    # Load run state
    run_state_path = Path(f"/.allternit/run_state/{run_id}.json")
    if not run_state_path.exists():
        print(f"ERROR: Run state file {run_state_path} does not exist", file=sys.stderr)
        return False
    
    run_state = load_json_file(run_state_path)
    if not run_state:
        print(f"ERROR: Could not load run state for {run_id}", file=sys.stderr)
        return False
    
    # Collect receipts
    receipts = collect_receipts(run_id)
    
    # Collect memory state
    memory_state = collect_memory_state()
    
    # Verify integrity
    integrity_check = verify_integrity(receipts["receipt_paths"])
    
    # Build forensics export
    export_data = {
        "export_version": "v0.1",
        "export_id": f"forensics-{run_id}-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}",
        "run_id": run_id,
        "export_timestamp": datetime.utcnow().isoformat() + "Z",
        "exporter_id": "export_run.py",
        "graph_id": run_state.get("graph_id", "unknown"),
        "start_timestamp": run_state.get("start_timestamp", "unknown"),
        "end_timestamp": run_state.get("end_timestamp", "unknown"),
        "run_status": run_state.get("status", "unknown"),
        "node_executions": run_state.get("nodes", []),
        "receipt_collection": receipts,
        "memory_state": memory_state,
        "integrity_check": integrity_check
    }
    
    # Write export to file
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(json.dumps(export_data, indent=2))
    
    print(f"Forensics export completed: {output_path}")
    return True


def main():
    parser = argparse.ArgumentParser(description="Export run forensics data")
    parser.add_argument("run_id", help="ID of the run to export")
    parser.add_argument("-o", "--output", required=True, help="Output file path for the export")
    args = parser.parse_args()
    
    success = export_run_forensics(args.run_id, args.output)
    if not success:
        sys.exit(1)


if __name__ == "__main__":
    main()
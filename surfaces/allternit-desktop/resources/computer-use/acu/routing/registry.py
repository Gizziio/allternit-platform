"""
Allternit Computer Use — Adapter Registry
Manages adapter instances and manifest lookup.
"""

from typing import Dict, Optional, List, Any
import json
import os
from pathlib import Path


class AdapterRegistry:
    """
    Registry of available adapters.
    Loads manifests from adapter directories and manages adapter instances.
    """

    def __init__(self, adapters_root: Optional[str] = None):
        self._manifests: Dict[str, Dict[str, Any]] = {}
        self._adapters: Dict[str, Any] = {}
        self._adapters_root = adapters_root or str(
            Path(__file__).resolve().parents[1] / "adapters"
        )

    def load_manifests(self) -> None:
        """Scan adapter directories and load all adapter.manifest.json files."""
        root = Path(self._adapters_root)
        if not root.exists():
            # Fall back to the default location adjacent to routing/
            root = Path(__file__).resolve().parents[1] / "adapters"
        if not root.exists():
            return

        for manifest_path in root.rglob("adapter.manifest.json"):
            try:
                with open(manifest_path) as f:
                    manifest = json.load(f)
                adapter_id = manifest.get("adapter_id")
                if adapter_id:
                    self._manifests[adapter_id] = manifest
            except (json.JSONDecodeError, IOError):
                continue

    def get_manifest(self, adapter_id: str) -> Optional[Dict[str, Any]]:
        """Get manifest for a specific adapter."""
        return self._manifests.get(adapter_id)

    def list_adapters(
        self,
        family: Optional[str] = None,
        grade: Optional[str] = None,
        production_status: Optional[str] = None,
        mode: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List all registered adapters, optionally filtered."""
        results = list(self._manifests.values())
        if family:
            results = [m for m in results if m.get("family") == family]
        if grade:
            # Support both old conformance_grade and new guarantees.conformance
            results = [m for m in results
                       if m.get("conformance_grade") == grade
                       or m.get("guarantees", {}).get("conformance") == grade]
        if production_status:
            results = [m for m in results if m.get("production_status") == production_status]
        if mode:
            results = [m for m in results if mode in m.get("modes_supported", [])]
        return results

    def get_capability_classes(self, adapter_id: str) -> List[str]:
        """Get capability classes for an adapter."""
        manifest = self._manifests.get(adapter_id, {})
        return manifest.get("capability_classes", [])

    def supports(self, adapter_id: str, feature: str) -> bool:
        """Check if an adapter supports a specific feature.
        Checks both old 'supports' dict and new 'traits' dict (triState: yes/partial = True).
        """
        manifest = self._manifests.get(adapter_id, {})
        # New schema: traits with triState values
        traits = manifest.get("traits", {})
        if feature in traits:
            return traits[feature] in ("yes", "partial")
        # Old schema: supports dict with bool values
        return manifest.get("supports", {}).get(feature, False)

    def get_guarantee_grade(self, adapter_id: str, guarantee: str) -> str:
        """Get a specific guarantee grade (semantic/policy/receipt/conformance/routing_confidence)."""
        manifest = self._manifests.get(adapter_id, {})
        return manifest.get("guarantees", {}).get(guarantee, "X")

    def is_production_grade(self, adapter_id: str) -> bool:
        """Check if adapter is production-grade."""
        manifest = self._manifests.get(adapter_id, {})
        return manifest.get("production_status") == "production"

    def is_routable(self, adapter_id: str) -> bool:
        """Check if adapter is safe for automatic routing (production or beta)."""
        manifest = self._manifests.get(adapter_id, {})
        return manifest.get("production_status") in ("production", "beta")

    def register_adapter_instance(self, adapter_id: str, instance: Any) -> None:
        """Register a live adapter instance."""
        self._adapters[adapter_id] = instance

    def get_adapter_instance(self, adapter_id: str) -> Optional[Any]:
        """Get a live adapter instance."""
        return self._adapters.get(adapter_id)

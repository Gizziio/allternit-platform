"""
A2R Computer Use — Plugin System
Loads and registers domain-specific workflow plugins.

Each plugin lives in a subdirectory under plugins/ and must contain a
plugin.json manifest that conforms to contracts/plugin.manifest.schema.json.

Directory layout expected per plugin:
    plugins/<id>/
        plugin.json         <- manifest (required)
        cookbooks/          <- *.md cookbook files
        prompts/            <- *.txt prompt templates

Usage:
    from packages.computer_use.plugins import PluginRegistry, PluginLoader

    registry = PluginRegistry()
    registry.discover()

    plugin = registry.get("github")
    loader  = PluginLoader()
    text    = loader.load_cookbook(plugin, "review-pr")
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

VALID_FAMILIES = frozenset(["browser", "desktop", "retrieval", "hybrid"])
VALID_MODES = frozenset(["assist", "execute", "inspect", "parallel", "crawl", "desktop", "hybrid"])
VALID_PRODUCTION_STATUSES = frozenset(["experimental", "beta", "production"])

# Semver pattern (same one used in the JSON Schema)
_SEMVER_RE = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?"
    r"(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$"
)
_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*[a-z0-9]$")


@dataclass
class PluginManifest:
    """Parsed and validated representation of a plugin.json manifest."""

    id: str
    name: str
    version: str
    description: str
    families: list[str]
    modes: list[str]
    permissions: list[str]
    golden_paths: list[str]
    cookbooks: list[str]
    conformance_suite: str
    production_status: str
    policy_profile: dict
    author: str
    tags: list[str]

    # Optional extras
    homepage: str = ""
    min_computer_use_version: str = ""
    prompts: list[str] = field(default_factory=list)

    # Internal: absolute path to the plugin directory (not serialized)
    _path: str = field(default="", repr=False)

    @classmethod
    def from_dict(cls, data: dict, plugin_dir: str = "") -> "PluginManifest":
        """Construct a PluginManifest from a raw parsed manifest dict."""
        return cls(
            id=data["id"],
            name=data["name"],
            version=data["version"],
            description=data["description"],
            families=list(data["families"]),
            modes=list(data["modes"]),
            permissions=list(data.get("permissions", [])),
            golden_paths=list(data.get("golden_paths", [])),
            cookbooks=list(data.get("cookbooks", [])),
            conformance_suite=data["conformance_suite"],
            production_status=data["production_status"],
            policy_profile=dict(data["policy_profile"]),
            author=data["author"],
            tags=list(data.get("tags", [])),
            homepage=data.get("homepage", ""),
            min_computer_use_version=data.get("min_computer_use_version", ""),
            prompts=list(data.get("prompts", [])),
            _path=plugin_dir,
        )

    def to_dict(self) -> dict:
        """Serialize back to a plain dict (excludes internal _path)."""
        d: dict = {
            "id": self.id,
            "name": self.name,
            "version": self.version,
            "description": self.description,
            "families": self.families,
            "modes": self.modes,
            "permissions": self.permissions,
            "golden_paths": self.golden_paths,
            "cookbooks": self.cookbooks,
            "conformance_suite": self.conformance_suite,
            "production_status": self.production_status,
            "policy_profile": self.policy_profile,
            "author": self.author,
            "tags": self.tags,
        }
        if self.homepage:
            d["homepage"] = self.homepage
        if self.min_computer_use_version:
            d["min_computer_use_version"] = self.min_computer_use_version
        if self.prompts:
            d["prompts"] = self.prompts
        return d


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

class PluginRegistry:
    """Discovers, loads, and serves plugin manifests from a plugins directory.

    Plugins are discovered lazily: call ``discover()`` to scan the directory
    and populate the internal index.  After that, ``get()``, ``list_all()``,
    ``list_by_family()``, and ``list_by_tag()`` are available.
    """

    def __init__(self, plugins_dir: Optional[str] = None) -> None:
        if plugins_dir is None:
            # Default: the directory containing this __init__.py
            plugins_dir = str(Path(__file__).parent)
        self._plugins_dir = Path(plugins_dir)
        self._index: dict[str, PluginManifest] = {}
        self._discovered = False

    # ------------------------------------------------------------------
    # Discovery
    # ------------------------------------------------------------------

    def discover(self) -> list[PluginManifest]:
        """Scan plugins_dir for subdirectories containing a plugin.json.

        Each eligible subdirectory must have a ``plugin.json`` at its root.
        The manifest is loaded, validated, and indexed by plugin id.

        Subdirectories that start with ``_`` or ``.`` are skipped (they are
        treated as internal/private directories, e.g. ``__pycache__``).

        Returns the list of successfully loaded manifests.  Manifests that
        fail validation are skipped with a warning printed to stderr.
        """
        self._index.clear()
        loaded: list[PluginManifest] = []

        if not self._plugins_dir.is_dir():
            import sys
            print(
                f"[PluginRegistry] plugins_dir does not exist: {self._plugins_dir}",
                file=sys.stderr,
            )
            self._discovered = True
            return loaded

        for entry in sorted(self._plugins_dir.iterdir()):
            if not entry.is_dir():
                continue
            if entry.name.startswith(("_", ".")):
                continue

            manifest_file = entry / "plugin.json"
            if not manifest_file.is_file():
                continue

            try:
                with manifest_file.open("r", encoding="utf-8") as fh:
                    data = json.load(fh)
            except (json.JSONDecodeError, OSError) as exc:
                import sys
                print(
                    f"[PluginRegistry] Failed to read {manifest_file}: {exc}",
                    file=sys.stderr,
                )
                continue

            valid, errors = self.validate_manifest(data)
            if not valid:
                import sys
                print(
                    f"[PluginRegistry] Manifest validation failed for {manifest_file}:\n"
                    + "\n".join(f"  - {e}" for e in errors),
                    file=sys.stderr,
                )
                continue

            manifest = PluginManifest.from_dict(data, plugin_dir=str(entry))

            if manifest.id in self._index:
                import sys
                print(
                    f"[PluginRegistry] Duplicate plugin id '{manifest.id}' "
                    f"(from {entry}); skipping.",
                    file=sys.stderr,
                )
                continue

            self._index[manifest.id] = manifest
            loaded.append(manifest)

        self._discovered = True
        return loaded

    # ------------------------------------------------------------------
    # Lookups
    # ------------------------------------------------------------------

    def get(self, plugin_id: str) -> Optional[PluginManifest]:
        """Return the manifest for ``plugin_id``, or None if not found."""
        self._ensure_discovered()
        return self._index.get(plugin_id)

    def list_all(self) -> list[PluginManifest]:
        """Return all loaded plugin manifests, sorted by id."""
        self._ensure_discovered()
        return sorted(self._index.values(), key=lambda m: m.id)

    def list_by_family(self, family: str) -> list[PluginManifest]:
        """Return all plugins that include the given adapter family."""
        self._ensure_discovered()
        return sorted(
            [m for m in self._index.values() if family in m.families],
            key=lambda m: m.id,
        )

    def list_by_tag(self, tag: str) -> list[PluginManifest]:
        """Return all plugins that carry the given tag."""
        self._ensure_discovered()
        return sorted(
            [m for m in self._index.values() if tag in m.tags],
            key=lambda m: m.id,
        )

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    def validate_manifest(self, data: dict) -> tuple[bool, list[str]]:
        """Validate a raw manifest dict against the plugin manifest schema.

        Does structural validation without requiring jsonschema to be
        installed (the JSON Schema file is used as the authoritative
        source-of-truth, but runtime validation is done in pure Python for
        portability).  If the ``jsonschema`` package is available it is used
        in addition for exhaustive validation.

        Returns:
            (True, [])            — manifest is valid
            (False, [error, …])   — manifest is invalid; errors lists reasons
        """
        errors: list[str] = []

        # --- required fields ---
        required = [
            "id", "name", "version", "description", "families", "modes",
            "permissions", "golden_paths", "cookbooks", "conformance_suite",
            "production_status", "policy_profile", "author", "tags",
        ]
        for field_name in required:
            if field_name not in data:
                errors.append(f"Missing required field: '{field_name}'")

        if errors:
            # Don't attempt further checks if required fields are absent
            return False, errors

        # --- id ---
        if not isinstance(data["id"], str) or not _ID_RE.match(data["id"]):
            errors.append(
                f"'id' must be a lowercase kebab-case string with at least 2 chars, got: {data['id']!r}"
            )

        # --- name ---
        if not isinstance(data["name"], str) or not data["name"].strip():
            errors.append("'name' must be a non-empty string")

        # --- version (semver) ---
        if not isinstance(data["version"], str) or not _SEMVER_RE.match(data["version"]):
            errors.append(f"'version' must be a valid semver string, got: {data['version']!r}")

        # --- description ---
        if not isinstance(data["description"], str) or len(data["description"]) < 10:
            errors.append("'description' must be a string of at least 10 characters")

        # --- families ---
        if not isinstance(data["families"], list) or len(data["families"]) == 0:
            errors.append("'families' must be a non-empty array")
        else:
            unknown = set(data["families"]) - VALID_FAMILIES
            if unknown:
                errors.append(f"'families' contains unknown values: {sorted(unknown)}")

        # --- modes ---
        if not isinstance(data["modes"], list) or len(data["modes"]) == 0:
            errors.append("'modes' must be a non-empty array")
        else:
            unknown = set(data["modes"]) - VALID_MODES
            if unknown:
                errors.append(f"'modes' contains unknown values: {sorted(unknown)}")

        # --- permissions ---
        if not isinstance(data["permissions"], list):
            errors.append("'permissions' must be an array")

        # --- golden_paths ---
        if not isinstance(data["golden_paths"], list):
            errors.append("'golden_paths' must be an array")
        else:
            gp_re = re.compile(r"^GP-[0-9]{2,}$")
            bad_gps = [gp for gp in data["golden_paths"] if not gp_re.match(str(gp))]
            if bad_gps:
                errors.append(f"'golden_paths' items must match GP-<NN>, bad: {bad_gps}")

        # --- cookbooks ---
        if not isinstance(data["cookbooks"], list):
            errors.append("'cookbooks' must be an array")

        # --- conformance_suite ---
        if not isinstance(data["conformance_suite"], str) or not data["conformance_suite"].strip():
            errors.append("'conformance_suite' must be a non-empty string")

        # --- production_status ---
        if data.get("production_status") not in VALID_PRODUCTION_STATUSES:
            errors.append(
                f"'production_status' must be one of {sorted(VALID_PRODUCTION_STATUSES)}, "
                f"got: {data.get('production_status')!r}"
            )

        # --- policy_profile ---
        pp = data.get("policy_profile")
        if not isinstance(pp, dict):
            errors.append("'policy_profile' must be an object")
        else:
            for pp_field in ["max_destructive_actions", "requires_approval", "allowed_domains", "blocked_actions"]:
                if pp_field not in pp:
                    errors.append(f"'policy_profile' missing required field: '{pp_field}'")
            if "requires_approval" in pp and not isinstance(pp["requires_approval"], bool):
                errors.append("'policy_profile.requires_approval' must be a boolean")
            if "allowed_domains" in pp and not isinstance(pp["allowed_domains"], list):
                errors.append("'policy_profile.allowed_domains' must be an array")
            if "blocked_actions" in pp and not isinstance(pp["blocked_actions"], list):
                errors.append("'policy_profile.blocked_actions' must be an array")
            mda = pp.get("max_destructive_actions")
            if mda is not None and (not isinstance(mda, int) or mda < 0):
                errors.append("'policy_profile.max_destructive_actions' must be a non-negative integer or null")

        # --- author ---
        if not isinstance(data["author"], str) or not data["author"].strip():
            errors.append("'author' must be a non-empty string")

        # --- tags ---
        if not isinstance(data["tags"], list):
            errors.append("'tags' must be an array")

        # --- optional: deep jsonschema validation if available ---
        if not errors:
            try:
                import jsonschema  # type: ignore

                schema_path = (
                    Path(__file__).parent.parent
                    / "contracts"
                    / "plugin.manifest.schema.json"
                )
                if schema_path.is_file():
                    with schema_path.open("r", encoding="utf-8") as fh:
                        schema = json.load(fh)
                    validator = jsonschema.Draft202012Validator(schema)
                    for error in sorted(
                        validator.iter_errors(data), key=lambda e: list(e.path)
                    ):
                        errors.append(f"Schema: {error.message} (at {list(error.path)})")
            except ImportError:
                pass  # jsonschema not installed — skip deep validation

        return len(errors) == 0, errors

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _ensure_discovered(self) -> None:
        if not self._discovered:
            self.discover()


# ---------------------------------------------------------------------------
# Loader
# ---------------------------------------------------------------------------

class PluginLoader:
    """Loads plugin cookbooks and prompt templates from the plugin directory.

    Files are loaded from the plugin's ``_path`` (set by the registry on
    discovery).  The loader is intentionally stateless: no caching.
    """

    # ------------------------------------------------------------------
    # Cookbooks
    # ------------------------------------------------------------------

    def load_cookbook(self, plugin: PluginManifest, cookbook_id: str) -> Optional[str]:
        """Load a cookbook markdown file from the plugin's ``cookbooks/`` directory.

        Args:
            plugin:      Loaded PluginManifest (must have ``_path`` set).
            cookbook_id: The cookbook id string (e.g. ``"review-pr"``).
                         The loader tries ``<cookbook_id>.md`` first, then
                         ``<cookbook_id>`` verbatim.

        Returns:
            File contents as a string, or None if not found.
        """
        if not plugin._path:
            return None

        cookbooks_dir = Path(plugin._path) / "cookbooks"
        return self._load_file(cookbooks_dir, cookbook_id, suffix=".md")

    def list_cookbooks(self, plugin: PluginManifest) -> list[str]:
        """Return the ids of all cookbooks present on disk for the given plugin."""
        if not plugin._path:
            return []
        cookbooks_dir = Path(plugin._path) / "cookbooks"
        return self._list_files(cookbooks_dir, suffix=".md")

    # ------------------------------------------------------------------
    # Prompts
    # ------------------------------------------------------------------

    def load_prompt(self, plugin: PluginManifest, prompt_id: str) -> Optional[str]:
        """Load a prompt template from the plugin's ``prompts/`` directory.

        Args:
            plugin:    Loaded PluginManifest (must have ``_path`` set).
            prompt_id: The prompt id (e.g. ``"review-pr"``).
                       Tries ``<prompt_id>.txt`` first, then verbatim.

        Returns:
            File contents as a string, or None if not found.
        """
        if not plugin._path:
            return None

        prompts_dir = Path(plugin._path) / "prompts"
        return self._load_file(prompts_dir, prompt_id, suffix=".txt")

    def list_prompts(self, plugin: PluginManifest) -> list[str]:
        """Return the ids of all prompt templates present on disk."""
        if not plugin._path:
            return []
        prompts_dir = Path(plugin._path) / "prompts"
        return self._list_files(prompts_dir, suffix=".txt")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _load_file(directory: Path, name: str, suffix: str) -> Optional[str]:
        """Try to load ``<directory>/<name><suffix>`` then ``<directory>/<name>``."""
        if not directory.is_dir():
            return None

        candidates = [
            directory / f"{name}{suffix}",
            directory / name,
        ]
        for candidate in candidates:
            if candidate.is_file():
                try:
                    return candidate.read_text(encoding="utf-8")
                except OSError:
                    return None
        return None

    @staticmethod
    def _list_files(directory: Path, suffix: str) -> list[str]:
        """Return sorted list of file stems for files with ``suffix`` in ``directory``."""
        if not directory.is_dir():
            return []
        return sorted(
            p.stem
            for p in directory.iterdir()
            if p.is_file() and p.suffix == suffix
        )


# ---------------------------------------------------------------------------
# Module-level convenience singleton
# ---------------------------------------------------------------------------

_default_registry: Optional[PluginRegistry] = None


def get_registry() -> PluginRegistry:
    """Return (and lazily initialise) the module-level default PluginRegistry."""
    global _default_registry
    if _default_registry is None:
        _default_registry = PluginRegistry()
    return _default_registry


__all__ = [
    "PluginManifest",
    "PluginRegistry",
    "PluginLoader",
    "get_registry",
]

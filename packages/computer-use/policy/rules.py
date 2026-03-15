"""
A2R Computer Use — Policy Rule Definitions
Custom rules can be added here or loaded from configuration.
"""

from . import PolicyRule
from typing import List


def load_custom_rules(config_path: str = None) -> List[PolicyRule]:
    """Load custom policy rules from a JSON configuration file."""
    if not config_path:
        return []

    import json
    from pathlib import Path

    path = Path(config_path)
    if not path.exists():
        return []

    try:
        with open(path) as f:
            raw_rules = json.load(f)

        rules = []
        for raw in raw_rules:
            rules.append(PolicyRule(
                rule_id=raw["rule_id"],
                name=raw["name"],
                description=raw.get("description", ""),
                rule_type=raw["rule_type"],
                condition=raw.get("condition", {}),
                decision=raw["decision"],
                overrides=raw.get("overrides"),
                priority=raw.get("priority", 0),
            ))
        return rules
    except (json.JSONDecodeError, KeyError):
        return []

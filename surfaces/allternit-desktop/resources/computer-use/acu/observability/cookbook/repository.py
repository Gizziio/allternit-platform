"""
Cookbook repository for storing and retrieving entries.
"""

import json
from pathlib import Path
from typing import Optional

from .promoter import CookbookEntry


class CookbookRepository:
    """
    Repository for cookbook entries.
    
    Supports:
    - Save/load entries
    - Search by category, tags, complexity
    - Get examples for planner training
    """
    
    def __init__(self, storage_path: str = "/tmp/allternit-cookbook"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self.index_path = self.storage_path / "index.json"
        self._index: dict[str, dict] = {}
        self._load_index()
    
    def _load_index(self) -> None:
        """Load the cookbook index."""
        if self.index_path.exists():
            with open(self.index_path) as f:
                self._index = json.load(f)
    
    async def _save_index(self) -> None:
        """Save the cookbook index."""
        with open(self.index_path, 'w') as f:
            json.dump(self._index, f, indent=2)
    
    async def save(self, entry: CookbookEntry) -> None:
        """Save a cookbook entry."""
        # Save full entry
        entry_path = self.storage_path / f"{entry.id}.json"
        with open(entry_path, 'w') as f:
            json.dump(entry.to_dict(), f, indent=2)
        
        # Update index
        self._index[entry.id] = {
            "id": entry.id,
            "task_category": entry.task_category,
            "complexity": entry.complexity,
            "total_steps": entry.total_steps,
            "tags": entry.tags,
            "stability_score": entry.stability_score,
            "success_count": entry.success_count,
            "created_at": entry.created_at.isoformat(),
        }
        
        await self._save_index()
    
    async def get(self, entry_id: str) -> Optional[CookbookEntry]:
        """Load a cookbook entry by ID."""
        entry_path = self.storage_path / f"{entry_id}.json"
        if not entry_path.exists():
            return None
        
        with open(entry_path) as f:
            data = json.load(f)
        
        from datetime import datetime
        
        return CookbookEntry(
            id=data["id"],
            created_at=datetime.fromisoformat(data["created_at"]),
            source_run_id=data.get("source_run_id", ""),
            task_description=data.get("task_description", ""),
            task_category=data.get("task_category", ""),
            complexity=data.get("complexity", "medium"),
            actions=data.get("actions", []),
            total_steps=data.get("total_steps", 0),
            expected_duration_ms=data.get("expected_duration_ms", 0),
            replay_gif_path=data.get("replay_gif_path"),
            replay_video_path=data.get("replay_video_path"),
            example_prompt=data.get("example_prompt", ""),
            success_count=data.get("success_count", 0),
            tags=data.get("tags", []),
            conformance_scenario=data.get("conformance_scenario"),
        )
    
    async def list_all(self) -> list[dict]:
        """List all cookbook entries (index only)."""
        return list(self._index.values())
    
    async def find_by_category(self, category: str) -> list[dict]:
        """Find entries by category."""
        return [
            e for e in self._index.values()
            if e.get("task_category") == category
        ]
    
    async def find_by_tags(self, tags: list[str]) -> list[dict]:
        """Find entries matching any of the tags."""
        return [
            e for e in self._index.values()
            if any(t in e.get("tags", []) for t in tags)
        ]
    
    async def find_by_complexity(self, complexity: str) -> list[dict]:
        """Find entries by complexity level."""
        return [
            e for e in self._index.values()
            if e.get("complexity") == complexity
        ]
    
    async def get_examples_for_training(self, count: int = 5) -> list[str]:
        """Get prompt examples for planner training."""
        # Get highest quality entries
        entries = sorted(
            self._index.values(),
            key=lambda e: (e.get("stability_score", 0), e.get("success_count", 0)),
            reverse=True
        )[:count]
        
        examples = []
        for entry_summary in entries:
            entry = await self.get(entry_summary["id"])
            if entry:
                examples.append(entry.to_prompt_example())
        
        return examples
    
    async def get_system_prompt_additions(self) -> list[str]:
        """Get all system prompt additions."""
        additions = []
        for entry_summary in self._index.values():
            entry = await self.get(entry_summary["id"])
            if entry and entry.system_prompt_addition:
                additions.append(entry.system_prompt_addition)
        return additions
    
    async def increment_success(self, entry_id: str) -> None:
        """Increment success count for an entry."""
        if entry_id in self._index:
            self._index[entry_id]["success_count"] = self._index[entry_id].get("success_count", 0) + 1
            await self._save_index()

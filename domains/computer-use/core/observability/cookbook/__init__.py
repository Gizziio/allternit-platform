"""
Allternit Computer Use Observability - Cookbook

Promote successful runs to reusable cookbook entries.
Capture patterns, golden paths, and failure modes.
"""

from .promoter import CookbookPromoter, CookbookEntry, PromotionCriteria
from .repository import CookbookRepository

__all__ = [
    "CookbookPromoter",
    "CookbookEntry", 
    "PromotionCriteria",
    "CookbookRepository",
]

"""Dependency-free synchronous client for the Allternit Computers API."""

from .client import AllternitComputersClient, ComputersAPIError

__all__ = ["AllternitComputersClient", "ComputersAPIError"]

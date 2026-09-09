"""
Allternit Computer Use — WebMCP Site Tool Registry

Python mirror of the TS site-tools registry
(allternit-browser/src/browser/site-tools/registry.ts).

A site tool is a WebMCP-shaped descriptor (name, description, inputSchema)
bound to plugin policy (allowed_domains, blocked_actions) and a handler.
Blocked actions are refused at the tool boundary — a refused call never
reaches a browser primitive.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Optional
from urllib.parse import urlparse

HandlerFn = Callable[[Dict[str, Any], "WebMcpContext"], Awaitable["SiteToolResult"]]


@dataclass
class WebMcpContext:
    """Context handed to a site tool handler.

    ``page`` is a Playwright Page on a CDP-connected session's active tab.
    When ``dry_run`` is true the handler must not touch the browser; it
    returns the plan it would execute (smoke tests, pre-flight checks).
    """

    page: Any = None
    dry_run: bool = False


@dataclass
class SiteToolDescriptor:
    name: str
    description: str
    input_schema: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "inputSchema": self.input_schema,
        }


@dataclass
class SiteToolResult:
    ok: bool
    summary: str
    refused: bool = False
    reason: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ok": self.ok,
            "summary": self.summary,
            "refused": self.refused,
            "reason": self.reason,
            "data": self.data,
        }


@dataclass
class SiteTool:
    descriptor: SiteToolDescriptor
    allowed_domains: List[str]
    blocked_actions: List[str]
    actions: List[str]
    handler: HandlerFn


def refused(reason: str, extra: Optional[Dict[str, Any]] = None) -> SiteToolResult:
    data = dict(extra or {})
    return SiteToolResult(
        ok=False,
        refused=True,
        reason=reason,
        summary=f"Refused: {reason}",
        data=data,
    )


def domain_matches(domain_pattern: str, hostname: str) -> bool:
    """Match a hostname against an allowed-domain entry (one leading wildcard label)."""
    pattern = domain_pattern.lower()
    host = hostname.lower()
    if pattern.startswith("*."):
        suffix = pattern[2:]
        return host == suffix or host.endswith("." + suffix)
    return host == pattern


def origin_matches(origin: Optional[str], allowed_domains: List[str]) -> bool:
    """Match an origin (e.g. 'https://github.com') against a tool's allowed domains."""
    if not origin:
        return False
    try:
        hostname = urlparse(origin).hostname or ""
    except ValueError:
        return False
    return any(domain_matches(domain, hostname) for domain in allowed_domains)


class SiteToolRegistry:
    """Registry of site tools with blocked-action enforcement at the boundary."""

    def __init__(self) -> None:
        self._tools: Dict[str, SiteTool] = {}

    def register(self, tool: SiteTool) -> None:
        if tool.descriptor.name in self._tools:
            raise ValueError(f"Site tool already registered: {tool.descriptor.name}")
        statically_blocked = [a for a in tool.actions if a in tool.blocked_actions]
        if statically_blocked:
            raise ValueError(
                f"Site tool {tool.descriptor.name} declares actions blocked by its "
                f"plugin policy: {', '.join(statically_blocked)}"
            )
        self._tools[tool.descriptor.name] = tool

    def register_all(self, tools: List[SiteTool]) -> None:
        for tool in tools:
            self.register(tool)

    def get(self, name: str) -> Optional[SiteTool]:
        return self._tools.get(name)

    def list(self) -> List[SiteTool]:
        return list(self._tools.values())

    def descriptors(self) -> List[SiteToolDescriptor]:
        return [tool.descriptor for tool in self._tools.values()]

    def tools_for_origin(self, origin: Optional[str]) -> List[SiteTool]:
        """Tools whose allowed_domains match the given origin."""
        return [tool for tool in self._tools.values() if origin_matches(origin, tool.allowed_domains)]

    async def invoke(
        self,
        name: str,
        args: Dict[str, Any],
        ctx: WebMcpContext,
    ) -> SiteToolResult:
        """Invoke a tool by name. Blocked actions are refused here, at the
        tool boundary — a refused call never reaches a browser primitive."""
        tool = self._tools.get(name)
        if tool is None:
            return refused(f"Unknown site tool: {name}")
        requested = args.get("requestedAction")
        if isinstance(requested, str) and requested in tool.blocked_actions:
            return refused(
                f"Action '{requested}' is blocked by the {tool.descriptor.name} plugin policy",
                extra={"tool": name},
            )
        return await tool.handler(args, ctx)

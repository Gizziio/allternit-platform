"""
Allternit Computer Use — WebMCP Site Tools Adapter

Python-side mirror of the TS site-tools layer
(infrastructure/chrome-stream/agent-systems/allternit-browser/src/browser/site-tools/):
a registry of WebMCP-shaped site tools derived from the gmail/github/notion
plugin manifests, plus an in-page bridge installing
``window.__allternitSiteTools`` with listTools/invokeTool.
"""

from .registry import (
    SiteTool,
    SiteToolDescriptor,
    SiteToolRegistry,
    SiteToolResult,
    WebMcpContext,
    domain_matches,
    origin_matches,
    refused,
)
from .adapters import (
    create_gmail_site_tools,
    create_github_site_tools,
    create_notion_site_tools,
    load_default_site_tools,
)
from .bridge import (
    MODEL_CONTEXT_PROBE_SOURCE,
    SITE_TOOLS_BRIDGE_SOURCE,
    SiteToolsBridge,
)
from .adapter import WebMcpAdapter

__all__ = [
    "SiteTool",
    "SiteToolDescriptor",
    "SiteToolRegistry",
    "SiteToolResult",
    "WebMcpContext",
    "domain_matches",
    "origin_matches",
    "refused",
    "create_gmail_site_tools",
    "create_github_site_tools",
    "create_notion_site_tools",
    "load_default_site_tools",
    "MODEL_CONTEXT_PROBE_SOURCE",
    "SITE_TOOLS_BRIDGE_SOURCE",
    "SiteToolsBridge",
    "WebMcpAdapter",
]

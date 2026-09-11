"""
Allternit Computer Use — WebMCP In-Page Bridge

Python mirror of allternit-browser/src/browser/site-tools/bridge.ts.

The bridge source is injected into pages (Playwright add_init_script or
evaluate) and installs ``window.__allternitSiteTools`` with WebMCP-shaped
listTools/invokeTool methods. It does NOT depend on native WebMCP support:
``navigator.modelContext`` is probed as an optional capability only — its
presence or absence is logged, never required.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from .registry import SiteToolDescriptor

logger = logging.getLogger(__name__)

try:
    from playwright.async_api import Page  # noqa: F401
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    Page = Any  # type: ignore


SITE_TOOLS_BRIDGE_SOURCE = r"""
(() => {
  if (window.__allternitSiteTools) return;
  const state = {
    tools: [],
    modelContextAvailable: false,
  };
  const probeModelContext = () => {
    try {
      state.modelContextAvailable = typeof navigator.modelContext !== 'undefined' && navigator.modelContext !== null;
    } catch {
      state.modelContextAvailable = false;
    }
    if (state.modelContextAvailable) {
      console.info('[allternit-site-tools] navigator.modelContext is available (native WebMCP surface detected; optional capability)');
    } else {
      console.info('[allternit-site-tools] navigator.modelContext not present; operating without native WebMCP');
    }
  };
  probeModelContext();
  window.__allternitSiteTools = {
    version: '1.0',
    registerTools(tools) {
      if (!Array.isArray(tools)) throw new Error('registerTools expects an array of { name, description, inputSchema }');
      const names = new Set(state.tools.map((tool) => tool.name));
      for (const tool of tools) {
        if (!tool || typeof tool.name !== 'string' || typeof tool.description !== 'string') {
          throw new Error('Each tool requires name and description');
        }
        if (names.has(tool.name)) continue;
        names.add(tool.name);
        state.tools.push({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema || { type: 'object', properties: {} },
        });
      }
      return state.tools.map((tool) => tool.name);
    },
    listTools() {
      return state.tools.map((tool) => ({ ...tool, inputSchema: { ...tool.inputSchema } }));
    },
    invokeTool(name, args) {
      const tool = state.tools.find((candidate) => candidate.name === name);
      if (!tool) {
        return Promise.reject(new Error('Unknown site tool: ' + name));
      }
      // In-page dispatch: handlers are page-provided (e.g. by the site itself
      // via WebMCP). Python-side handlers are driven through the adapter.
      const dispatcher = window.__allternitSiteTools.__handlers && window.__allternitSiteTools.__handlers[name];
      if (typeof dispatcher !== 'function') {
        return Promise.reject(new Error('No in-page handler registered for tool: ' + name));
      }
      return Promise.resolve(dispatcher(args || {}));
    },
    modelContextAvailable() {
      return state.modelContextAvailable;
    },
  };
})();
"""

MODEL_CONTEXT_PROBE_SOURCE = r"""
(() => {
  try {
    return typeof navigator.modelContext !== 'undefined' && navigator.modelContext !== null;
  } catch {
    return false;
  }
})()
"""

_VERIFY_SOURCE = "(() => typeof window.__allternitSiteTools !== 'undefined' && window.__allternitSiteTools !== null)()"


class SiteToolsBridge:
    """
    Installs and drives the ``window.__allternitSiteTools`` bridge on a
    Playwright Page (which may be CDP-connected via ``connect_over_cdp``,
    mirroring RemoteCDPAdapter's session plumbing).
    """

    def __init__(self, page: "Page") -> None:
        self._page = page

    @property
    def page(self) -> "Page":
        return self._page

    async def install(self, add_init_script: bool = True) -> None:
        """Install the bridge. ``add_init_script`` also covers future navigations."""
        if add_init_script:
            await self._page.add_init_script(SITE_TOOLS_BRIDGE_SOURCE)
        await self._page.evaluate(SITE_TOOLS_BRIDGE_SOURCE)

    async def verify(self) -> bool:
        """True when ``window.__allternitSiteTools`` is present on the page."""
        try:
            return bool(await self._page.evaluate(_VERIFY_SOURCE))
        except Exception as exc:  # page closed/navigating
            logger.debug("[webmcp-bridge] verify failed: %s", exc)
            return False

    async def probe_model_context(self) -> bool:
        """
        Optional capability probe: reports whether the page exposes a native
        WebMCP surface (navigator.modelContext). Logged, never required.
        """
        try:
            available = bool(await self._page.evaluate(MODEL_CONTEXT_PROBE_SOURCE))
        except Exception as exc:
            logger.debug("[webmcp-bridge] modelContext probe failed: %s", exc)
            return False
        if available:
            logger.info("[webmcp-bridge] navigator.modelContext available (native WebMCP surface; optional capability)")
        else:
            logger.info("[webmcp-bridge] navigator.modelContext not present; operating without native WebMCP")
        return available

    async def register_tools(self, descriptors: List[SiteToolDescriptor]) -> List[str]:
        """Register tool descriptors into the in-page bridge. Returns registered names."""
        payload = [d.to_dict() for d in descriptors]
        return await self._page.evaluate(
            "(tools) => window.__allternitSiteTools.registerTools(tools)",
            payload,
        )

    async def list_tools(self) -> List[Dict[str, Any]]:
        """List tools visible in the page bridge (WebMCP-shaped)."""
        return await self._page.evaluate("() => window.__allternitSiteTools.listTools()")

    async def invoke_tool(self, name: str, args: Optional[Dict[str, Any]] = None) -> Any:
        """
        In-page dispatch. Raises RuntimeError when the tool is unknown or has
        no in-page handler — Python-side handlers run through WebMcpAdapter.
        """
        try:
            return await self._page.evaluate(
                "({ name, args }) => window.__allternitSiteTools.invokeTool(name, args)",
                {"name": name, "args": args or {}},
            )
        except Exception as exc:
            raise RuntimeError(f"in-page site tool invocation failed: {exc}") from exc

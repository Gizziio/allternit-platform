"""Canonical provider for an explicitly attached Playwright CDP browser."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from contracts.canonical import CapabilityManifest, ExecutionMode, Rect, Root
from providers.playwright_canonical import PlaywrightCanonicalProvider


class CDPCanonicalProvider(PlaywrightCanonicalProvider):
    provider_id = "browser.cdp.canonical"

    def __init__(self, adapter: Any, artifact_dir: str | Path) -> None:
        # Parent session manager is unused because _page and discover_roots are overridden.
        super().__init__(session_manager=None, artifact_dir=artifact_dir)
        self._adapter = adapter

    async def capabilities(self) -> CapabilityManifest:
        return CapabilityManifest(
            provider_id=self.provider_id,
            provider_version="1.0.0-alpha.1",
            operating_systems=("macos", "windows", "linux"),
            actions=(
                "navigate", "back", "forward", "reload", "click", "press",
                "setText", "typeText", "keypress", "scroll", "wait",
            ),
            observation_channels=("dom", "screenshot", "cdp"),
            execution_modes=(
                ExecutionMode.BACKGROUND_STRICT.value,
                ExecutionMode.FOREGROUND_ALLOWED.value,
            ),
            strict_background=True,
            semantic_input=True,
            raw_input=False,
            max_concurrency=8,
            limitations=("browser_only", "requires_existing_cdp_endpoint"),
        )

    async def _page(self, session_id: str, resource_id: str | None = None) -> Any:
        if resource_id and resource_id in self._resource_pages:
            page = self._resource_pages[resource_id]
            if not page.is_closed():
                return page
        if self._adapter._page is None:
            await self._adapter.initialize()
        page = self._adapter._page
        if resource_id:
            self._resource_pages[resource_id] = page
        return page

    async def discover_roots(self, *, session_id: str, environment_id: str) -> tuple[Root, ...]:
        if self._adapter._page is None:
            await self._adapter.initialize()
        roots = []
        index = 0
        for context in self._adapter._browser.contexts:
            for page in context.pages:
                if page.is_closed():
                    continue
                resource_id = f"cdp-page:{index}"
                index += 1
                self._resource_pages[resource_id] = page
                viewport = page.viewport_size or {"width": 1280, "height": 720}
                roots.append(
                    Root(
                        root_id=f"root_{resource_id}",
                        resource_id=resource_id,
                        kind="browser_page",
                        title=await page.title(),
                        application="chromium-cdp",
                        bounds=Rect(0, 0, viewport["width"], viewport["height"]),
                        focused=page is self._adapter._page,
                    )
                )
        return tuple(roots)

    async def close(self) -> None:
        await self._adapter.close()


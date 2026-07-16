"""Canonical provider over the gateway's existing Playwright SessionManager."""

from __future__ import annotations

import asyncio
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
from uuid import uuid4

from contracts.canonical import (
    ActionEvidence,
    ActionStep,
    ActionTransaction,
    CapabilityManifest,
    ElementNode,
    ExecutionMode,
    ImageEvidence,
    Observation,
    OutcomeStatus,
    Rect,
    Root,
    StepOutcome,
)


_DOM_SNAPSHOT_SCRIPT = r"""
() => {
  const candidates = Array.from(document.querySelectorAll(
    'a,button,input,textarea,select,option,[role],[contenteditable="true"],[tabindex],summary'
  )).slice(0, 500);
  const cssPath = (node) => {
    if (node.id) return `#${CSS.escape(node.id)}`;
    const parts = [];
    let current = node;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
      const parent = current.parentElement;
      if (!parent) break;
      const tag = current.tagName.toLowerCase();
      const peers = Array.from(parent.children).filter(child => child.tagName === current.tagName);
      const suffix = peers.length > 1 ? `:nth-of-type(${peers.indexOf(current) + 1})` : '';
      parts.unshift(`${tag}${suffix}`);
      current = parent;
    }
    return `body${parts.length ? ' > ' + parts.join(' > ') : ''}`;
  };
  const roleFor = (node) => node.getAttribute('role') || ({
    A: 'link', BUTTON: 'button', INPUT: node.type === 'checkbox' ? 'checkbox' :
      node.type === 'radio' ? 'radio' : 'textbox', TEXTAREA: 'textbox',
    SELECT: 'combobox', OPTION: 'option', SUMMARY: 'button'
  }[node.tagName] || node.tagName.toLowerCase());
  return candidates.map(node => {
    const rect = node.getBoundingClientRect();
    const style = window.getComputedStyle(node);
    const visible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    const name = node.getAttribute('aria-label') || node.innerText || node.value ||
      node.getAttribute('placeholder') || node.getAttribute('title') || '';
    const states = [];
    if (document.activeElement === node) states.push('focused');
    if (!visible) states.push('hidden');
    if (node.disabled || node.getAttribute('aria-disabled') === 'true') states.push('disabled');
    if (node.checked || node.getAttribute('aria-checked') === 'true') states.push('checked');
    const actions = [];
    if (!states.includes('disabled')) actions.push('click');
    if (node.matches('input,textarea,[contenteditable="true"]')) actions.push('setText', 'typeText');
    return {
      selector: cssPath(node), role: roleFor(node), name: String(name).trim().slice(0, 500),
      value: String(node.value || node.getAttribute('aria-valuetext') || '').slice(0, 500),
      description: String(node.getAttribute('aria-description') || '').slice(0, 500),
      bounds: {x: rect.x, y: rect.y, width: rect.width, height: rect.height}, states, actions
    };
  });
}
"""


class PlaywrightCanonicalProvider:
    provider_id = "browser.playwright.canonical"

    def __init__(self, session_manager: Any, artifact_dir: str | Path) -> None:
        self._sessions = session_manager
        self._artifact_dir = Path(artifact_dir)
        self._state_selectors: Dict[str, Dict[str, str]] = {}
        self._state_order: list[str] = []
        self._resource_pages: Dict[str, Any] = {}

    async def capabilities(self) -> CapabilityManifest:
        return CapabilityManifest(
            provider_id=self.provider_id,
            provider_version="1.0.0-alpha.1",
            operating_systems=("macos", "windows", "linux"),
            actions=(
                "navigate", "back", "forward", "reload", "click", "press",
                "setText", "typeText", "keypress", "scroll", "wait",
            ),
            observation_channels=("dom", "screenshot"),
            execution_modes=(ExecutionMode.SANDBOXED.value,),
            strict_background=False,
            semantic_input=True,
            raw_input=False,
            max_concurrency=10,
            limitations=("browser_only", "gateway_managed_chromium"),
        )

    async def _page(self, session_id: str, resource_id: Optional[str] = None) -> Any:
        context, page = await self._sessions.get_or_create_session(session_id)
        if resource_id and resource_id in self._resource_pages:
            candidate = self._resource_pages[resource_id]
            if not candidate.is_closed():
                return candidate
        if resource_id:
            self._resource_pages[resource_id] = page
        return page

    async def discover_roots(self, *, session_id: str, environment_id: str) -> tuple[Root, ...]:
        context, current = await self._sessions.get_or_create_session(session_id)
        roots = []
        for index, page in enumerate(context.pages):
            if page.is_closed():
                continue
            resource_id = f"browser-page:{session_id}:{index}"
            self._resource_pages[resource_id] = page
            viewport = page.viewport_size or {"width": 1280, "height": 720}
            roots.append(
                Root(
                    root_id=f"root_{resource_id}",
                    resource_id=resource_id,
                    kind="browser_page",
                    title=await page.title(),
                    application="chromium",
                    bounds=Rect(0, 0, viewport["width"], viewport["height"]),
                    focused=page is current,
                )
            )
        return tuple(roots)

    def _remember_selectors(self, state_id: str, selectors: Dict[str, str]) -> None:
        self._state_selectors[state_id] = selectors
        self._state_order.append(state_id)
        while len(self._state_order) > 128:
            evicted = self._state_order.pop(0)
            self._state_selectors.pop(evicted, None)

    async def observe(
        self,
        *,
        session_id: str,
        environment_id: str,
        resource_id: str,
        epoch: int,
    ) -> Observation:
        page = await self._page(session_id, resource_id)
        rows = await page.evaluate(_DOM_SNAPSHOT_SCRIPT)
        state_id = f"state_{uuid4().hex}"
        selectors: Dict[str, str] = {}
        elements = []
        for index, row in enumerate(rows, start=1):
            ref = f"@e{index}"
            selectors[ref] = str(row["selector"])
            bounds = row.get("bounds") or {}
            elements.append(
                ElementNode(
                    ref=ref,
                    role=str(row.get("role", "")),
                    name=str(row.get("name", "")),
                    value=str(row.get("value", "")),
                    description=str(row.get("description", "")),
                    bounds=Rect(
                        float(bounds.get("x", 0)),
                        float(bounds.get("y", 0)),
                        float(bounds.get("width", 0)),
                        float(bounds.get("height", 0)),
                    ),
                    states=tuple(str(value) for value in row.get("states", ())),
                    actions=tuple(str(value) for value in row.get("actions", ())),
                    provider_metadata={"selector": str(row["selector"])},
                )
            )

        screenshot = await page.screenshot(type="png")
        digest = hashlib.sha256(screenshot).hexdigest()
        self._artifact_dir.mkdir(parents=True, exist_ok=True)
        artifact_id = f"artifact_{uuid4().hex}"
        artifact_path = self._artifact_dir / f"{artifact_id}.png"
        artifact_path.write_bytes(screenshot)
        viewport = page.viewport_size or {"width": 1280, "height": 720}
        title = await page.title()
        self._remember_selectors(state_id, selectors)
        return Observation(
            state_id=state_id,
            session_id=session_id,
            environment_id=environment_id,
            resource_id=resource_id,
            epoch=epoch,
            captured_at=datetime.now(timezone.utc).isoformat(),
            provider_id=self.provider_id,
            provider_version="1.0.0-alpha.1",
            roots=(
                Root(
                    root_id=f"root_{resource_id}",
                    resource_id=resource_id,
                    kind="browser_page",
                    title=title,
                    application="chromium",
                    bounds=Rect(0, 0, viewport["width"], viewport["height"]),
                    focused=True,
                ),
            ),
            elements=tuple(elements),
            image=ImageEvidence(
                artifact_id=artifact_id,
                media_type="image/png",
                width=viewport["width"],
                height=viewport["height"],
                sha256=digest,
                coordinate_space="viewport_css_pixels",
            ),
            truncated=len(rows) >= 500,
            metadata={"url": page.url, "title": title, "artifact_path": str(artifact_path)},
        )

    def _selector(self, transaction: ActionTransaction, step: ActionStep) -> Optional[str]:
        if step.target is None or step.target.ref is None:
            return None
        selectors = self._state_selectors.get(transaction.base_state_id)
        if selectors is None:
            raise ValueError(f"Provider mapping for state {transaction.base_state_id!r} was evicted")
        try:
            return selectors[step.target.ref]
        except KeyError as error:
            raise ValueError(
                f"Ref {step.target.ref!r} is not known in state {transaction.base_state_id!r}"
            ) from error

    async def execute_step(
        self,
        *,
        transaction: ActionTransaction,
        index: int,
        step: ActionStep,
    ) -> StepOutcome:
        page = await self._page(transaction.session_id, transaction.resource_id)
        selector = self._selector(transaction, step)
        try:
            if step.action == "navigate":
                await page.goto(str(step.arguments["url"]), wait_until=step.arguments.get("wait_until", "domcontentloaded"))
            elif step.action == "back":
                await page.go_back()
            elif step.action == "forward":
                await page.go_forward()
            elif step.action == "reload":
                await page.reload()
            elif step.action in ("click", "press"):
                if selector is not None:
                    await page.locator(selector).click()
                elif step.target and step.target.x is not None and step.target.y is not None:
                    await page.mouse.click(step.target.x, step.target.y)
                else:
                    raise ValueError("Click requires a ref or coordinates")
            elif step.action == "setText":
                if selector is None:
                    raise ValueError("setText requires a ref target")
                await page.locator(selector).fill(str(step.arguments.get("text", "")))
            elif step.action == "typeText":
                text = str(step.arguments.get("text", ""))
                if selector is not None:
                    await page.locator(selector).press_sequentially(text)
                else:
                    await page.keyboard.type(text)
            elif step.action == "keypress":
                await page.keyboard.press(str(step.arguments["key"]))
            elif step.action == "scroll":
                await page.mouse.wheel(
                    float(step.arguments.get("delta_x", 0)),
                    float(step.arguments.get("delta_y", 0)),
                )
            elif step.action == "wait":
                await asyncio.sleep(max(0, float(step.arguments.get("milliseconds", 0))) / 1000)
            else:
                raise ValueError(f"Unsupported Playwright action {step.action!r}")
        except Exception as error:
            return StepOutcome(
                index=index,
                status=OutcomeStatus.DIDNT.value,
                evidence=ActionEvidence(
                    grounding="dom_selector" if selector else "browser_coordinate",
                    delivery="playwright",
                    details={"selector": selector},
                ),
                error_code=type(error).__name__,
                message=str(error),
            )

        return StepOutcome(
            index=index,
            status=OutcomeStatus.UNKNOWN.value,
            evidence=ActionEvidence(
                grounding="dom_selector" if selector else "browser_command",
                delivery="playwright",
                details={"selector": selector, "event_delivered": True},
            ),
            message="Input was delivered; semantic success requires a transaction postcondition",
        )

    async def close(self) -> None:
        # The gateway session manager owns the shared browser lifecycle.
        return None

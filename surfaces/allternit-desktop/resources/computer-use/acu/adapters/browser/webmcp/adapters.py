"""
Allternit Computer Use — WebMCP Site Tool Adapters

Site tools derived from the gmail/github/notion plugin manifests
(domains/computer-use/core/plugins/<id>/plugin.json) and their cookbooks.
Plugin manifests are loaded through the existing plugins package — policy
(allowed_domains, blocked_actions) is reused from plugin.json, never forked.

Python mirror of allternit-browser/src/browser/site-tools/adapters/{gmail,github,notion}.ts.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

_DOMAIN_CORE_ROOT = Path(__file__).resolve().parents[3]
if str(_DOMAIN_CORE_ROOT) not in sys.path:
    sys.path.insert(0, str(_DOMAIN_CORE_ROOT))

from plugins import PluginLoader, PluginManifest, PluginRegistry  # noqa: E402

from .registry import (  # noqa: E402
    SiteTool,
    SiteToolDescriptor,
    SiteToolResult,
    WebMcpContext,
    refused,
)

_SECTION_RE_TEMPLATE = r"^## {heading}[ \t]*\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))"


def read_cookbook_section(markdown: str, heading: str) -> str:
    """Extract a '## <heading>' section body from cookbook markdown."""
    escaped = re.escape(heading)
    match = re.search(_SECTION_RE_TEMPLATE.format(heading=escaped), markdown, re.M)
    return match.group(1).strip() if match else ""


def _require_page(ctx: WebMcpContext) -> Any:
    if ctx.page is None:
        raise RuntimeError(
            "site tool requires a CDP-connected Playwright page; "
            "attach one via WebMcpAdapter.attach_page() or pass dry_run=True"
        )
    return ctx.page


def _require_string(args: Dict[str, Any], field: str, tool: str) -> str:
    value = args.get(field)
    if not isinstance(value, str) or not value:
        raise ValueError(f"{tool} requires args.{field}")
    return value


def _string_list(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str) and item]


async def _extract_text(page: Any, selector: str, limit: int = 10) -> List[str]:
    fn = """(() => {
        const nodes = Array.from(document.querySelectorAll(%s));
        return nodes.slice(0, %d).map((node) => (node.innerText || node.textContent || '').trim());
    })()""" % (repr(selector), int(limit))
    result = await page.evaluate(fn)
    return [str(item) for item in result] if isinstance(result, list) else []


# ---------------------------------------------------------------------------
# Gmail — cookbook read-inbox.md → gmail.read_inbox
# ---------------------------------------------------------------------------

GMAIL_INBOX_URL = "https://mail.google.com/mail/u/0/#inbox"

_EXTRACT_UNREAD_FN = """(() => {
  const rows = Array.from(document.querySelectorAll("tr.zA.zE"));
  return rows.slice(0, 5).map((row) => ({
    sender: (row.querySelector('span.zF') || {}).textContent || '',
    subject: (row.querySelector('span.bog') || {}).textContent || '',
    snippet: (row.querySelector('span.y2') || {}).textContent || '',
    time: ((row.querySelector('span.xW span') || {}).textContent || '').trim(),
  }));
})()"""


async def _gmail_read_inbox(args: Dict[str, Any], ctx: WebMcpContext) -> SiteToolResult:
    requested = args.get("requestedAction") if isinstance(args.get("requestedAction"), str) else "read_inbox"
    if requested != "read_inbox":
        return refused(f"gmail.read_inbox does not perform action '{requested}'")
    max_messages = args.get("maxMessages")
    if not isinstance(max_messages, int) or isinstance(max_messages, bool) or max_messages <= 0:
        max_messages = 5
    max_messages = min(max_messages, 10)
    plan = [
        f"navigate {GMAIL_INBOX_URL}",
        "wait for div[role=main]",
        f"extract up to {max_messages} unread rows (tr.zA.zE): sender, subject, snippet, time",
    ]
    if ctx.dry_run:
        return SiteToolResult(ok=True, summary="dry-run: would read the Gmail inbox (inspect mode, no destructive actions)", data={"steps": plan})

    page = _require_page(ctx)
    await page.goto(GMAIL_INBOX_URL, wait_until="domcontentloaded")
    await page.wait_for_selector("div[role='main']", timeout=15_000)
    extracted = await page.evaluate(_EXTRACT_UNREAD_FN)
    messages = extracted[:max_messages] if isinstance(extracted, list) else []

    # Non-destructive walk through up to max_messages threads for bodies
    # (cookbook read-inbox.md steps 4b-4d).
    bodies: List[Optional[str]] = []
    for index in range(len(messages)):
        try:
            await page.locator("tr.zA.zE").nth(index).click()
            await page.wait_for_selector("div.a3s.aiL", timeout=10_000)
            body = await page.evaluate(
                "(() => { const node = document.querySelector('div.a3s.aiL');"
                " return node ? (node.innerText || '').slice(0, 1500) : null; })()"
            )
            bodies.append(body if isinstance(body, str) else None)
        except Exception:
            bodies.append(None)
        try:
            await page.locator("div[aria-label='Back to Inbox'], a[href='#inbox']").first.click()
            await page.wait_for_selector("div[role='main']", timeout=10_000)
        except Exception:
            await page.goto(GMAIL_INBOX_URL, wait_until="domcontentloaded")

    snippets = []
    for index, message in enumerate(messages):
        message = message if isinstance(message, dict) else {}
        snippets.append({
            "sender": message.get("sender", ""),
            "subject": message.get("subject", ""),
            "time": message.get("time", ""),
            "snippet": message.get("snippet", ""),
            "fullBody": bodies[index] if index < len(bodies) else None,
        })
    return SiteToolResult(
        ok=True,
        summary=f"Read {len(snippets)} unread message(s) from the Gmail inbox",
        data={"unreadCountVisible": len(snippets), "messages": snippets},
    )


def create_gmail_site_tools(
    manifest: PluginManifest,
    loader: Optional[PluginLoader] = None,
) -> List[SiteTool]:
    if manifest.id != "gmail":
        raise ValueError(f"Expected the gmail plugin manifest, got '{manifest.id}'")
    goal = "Open Gmail, identify unread messages, and extract sender, subject, and body preview."
    if loader is not None:
        goal = read_cookbook_section(loader.load_cookbook(manifest, "read-inbox") or "", "Goal") or goal

    return [
        SiteTool(
            descriptor=SiteToolDescriptor(
                name="gmail.read_inbox",
                description=(
                    f"{goal} Inspect mode: reads only; sending, deleting, and label "
                    "changes are never performed."
                ),
                input_schema={
                    "type": "object",
                    "properties": {
                        "maxMessages": {"type": "number", "description": "Unread messages to read (default 5, max 10)"},
                        "requestedAction": {"type": "string", "enum": ["read_inbox"]},
                    },
                    "required": [],
                    "additionalProperties": False,
                },
            ),
            allowed_domains=list(manifest.policy_profile.get("allowed_domains", [])),
            blocked_actions=list(manifest.policy_profile.get("blocked_actions", [])),
            actions=["read_inbox"],
            handler=_gmail_read_inbox,
        ),
    ]


# ---------------------------------------------------------------------------
# GitHub — cookbooks review-pr.md / triage-issue.md
# ---------------------------------------------------------------------------

GITHUB_COM = "github.com"


async def _github_review_pr(args: Dict[str, Any], ctx: WebMcpContext) -> SiteToolResult:
    pr_url = _require_string(args, "prUrl", "github.review_pr")
    review_text = _require_string(args, "reviewText", "github.review_pr")
    requested = args.get("requestedAction")
    requested = requested if isinstance(requested, str) else "post_review_comment"
    if requested != "post_review_comment":
        return refused(f"github.review_pr does not perform action '{requested}'")
    plan = [
        f"navigate {pr_url}",
        "extract PR metadata (title, author, files changed)",
        "open Files Changed tab and extract diff summary",
        "focus textarea#pull_request_review_body and type the review text",
        "select review type COMMENT and submit the form",
    ]
    if ctx.dry_run:
        return SiteToolResult(ok=True, summary=f"dry-run: would post a review comment on {pr_url}", data={"steps": plan})

    page = _require_page(ctx)
    await page.goto(pr_url, wait_until="domcontentloaded")
    await page.wait_for_selector("span.js-issue-title", timeout=15_000)
    pr_title = (await _extract_text(page, "span.js-issue-title", 1))[:1]
    await page.locator("a[data-tab-item='files-tab']").click()
    await page.wait_for_selector("div.js-diff-progressive-container", timeout=15_000)
    changed_files = await _extract_text(page, "div#files_bucket .file-header[data-path]", 50)
    await page.locator("button[data-hotkey='p']").click()
    await page.wait_for_selector("div.pull-request-review-menu", timeout=10_000)
    await page.locator("textarea#pull_request_review_body").click()
    await page.locator("textarea#pull_request_review_body").fill(review_text)
    await page.locator("input[value='COMMENT']").click()
    await page.locator("button.btn-primary[type='submit']").click()
    await page.wait_for_timeout(1_000)
    return SiteToolResult(
        ok=True,
        summary=f"Review comment posted on {pr_url}",
        data={"prUrl": pr_url, "prTitle": pr_title[0] if pr_title else "", "changedFiles": len(changed_files), "requestedAction": "post_review_comment"},
    )


async def _github_triage_issue(args: Dict[str, Any], ctx: WebMcpContext) -> SiteToolResult:
    issue_url = _require_string(args, "issueUrl", "github.triage_issue")
    comment = _require_string(args, "comment", "github.triage_issue")
    label = args.get("label")
    label = label if isinstance(label, str) and label else None
    requested = args.get("requestedAction")
    requested = requested if isinstance(requested, str) else None
    if requested and requested not in ("apply_label", "post_triage_comment"):
        return refused(f"github.triage_issue does not perform action '{requested}'")
    plan = [
        f"navigate {issue_url}",
        "extract issue title, body, labels, reporter",
        f"apply label '{label}' via the label picker" if label else "no label requested",
        "type triage comment into textarea#new_comment_field and submit",
    ]
    if ctx.dry_run:
        return SiteToolResult(ok=True, summary=f"dry-run: would triage {issue_url}", data={"steps": plan})

    page = _require_page(ctx)
    await page.goto(issue_url, wait_until="domcontentloaded")
    await page.wait_for_selector("h1.gh-header-title", timeout=15_000)
    issue_title = (await _extract_text(page, "h1.gh-header-title span.js-issue-title", 1))[:1]
    if label and requested != "post_triage_comment":
        await page.locator("details-menu[src*='/labels'] summary").click()
        await page.wait_for_selector("details-menu[src*='/labels'] .select-menu-item", timeout=10_000)
        await page.locator(f"div[role='menuitem']:has-text(\"{label}\")").click()
    await page.locator("textarea#new_comment_field").click()
    await page.locator("textarea#new_comment_field").fill(comment)
    await page.locator("button.btn-primary[type='submit']").click()
    await page.wait_for_timeout(1_000)
    return SiteToolResult(
        ok=True,
        summary=f"Issue triaged: {issue_url}",
        data={"issueUrl": issue_url, "issueTitle": issue_title[0] if issue_title else "", "label": label},
    )


def create_github_site_tools(
    manifest: PluginManifest,
    loader: Optional[PluginLoader] = None,
) -> List[SiteTool]:
    if manifest.id != "github":
        raise ValueError(f"Expected the github plugin manifest, got '{manifest.id}'")
    review_goal = "Open a GitHub pull request and post a structured review comment."
    triage_goal = "Read a GitHub issue, apply a label, and post a triage comment."
    if loader is not None:
        review_goal = read_cookbook_section(loader.load_cookbook(manifest, "review-pr") or "", "Goal") or review_goal
        triage_goal = read_cookbook_section(loader.load_cookbook(manifest, "triage-issue") or "", "Goal") or triage_goal

    return [
        SiteTool(
            descriptor=SiteToolDescriptor(
                name="github.review_pr",
                description=f"{review_goal} Actions: post_review_comment.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "prUrl": {"type": "string", "description": "URL of the pull request to review"},
                        "reviewText": {"type": "string", "description": "Review comment body"},
                        "requestedAction": {"type": "string", "enum": ["post_review_comment"]},
                    },
                    "required": ["prUrl", "reviewText"],
                    "additionalProperties": False,
                },
            ),
            allowed_domains=list(manifest.policy_profile.get("allowed_domains", [])),
            blocked_actions=list(manifest.policy_profile.get("blocked_actions", [])),
            actions=["post_review_comment"],
            handler=_github_review_pr,
        ),
        SiteTool(
            descriptor=SiteToolDescriptor(
                name="github.triage_issue",
                description=f"{triage_goal} Actions: apply_label, post_triage_comment.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "issueUrl": {"type": "string", "description": "URL of the issue to triage"},
                        "comment": {"type": "string", "description": "Triage comment body"},
                        "label": {"type": "string", "description": "Optional label to apply"},
                        "requestedAction": {"type": "string", "enum": ["apply_label", "post_triage_comment"]},
                    },
                    "required": ["issueUrl", "comment"],
                    "additionalProperties": False,
                },
            ),
            allowed_domains=list(manifest.policy_profile.get("allowed_domains", [])),
            blocked_actions=list(manifest.policy_profile.get("blocked_actions", [])),
            actions=["apply_label", "post_triage_comment"],
            handler=_github_triage_issue,
        ),
    ]


# ---------------------------------------------------------------------------
# Notion — cookbook create-page.md → notion.create_page
# ---------------------------------------------------------------------------

NOTION_WORKSPACE_URL = "https://www.notion.so"


async def _notion_create_page(args: Dict[str, Any], ctx: WebMcpContext) -> SiteToolResult:
    title = _require_string(args, "title", "notion.create_page")
    requested = args.get("requestedAction")
    requested = requested if isinstance(requested, str) else "create_notion_page"
    if requested != "create_notion_page":
        return refused(f"notion.create_page does not perform action '{requested}'")
    parent_url = args.get("parentUrl")
    parent_url = parent_url if isinstance(parent_url, str) and parent_url else NOTION_WORKSPACE_URL
    paragraphs = _string_list(args.get("paragraphs"))
    todo_items = _string_list(args.get("todoItems"))
    plan = [
        f"navigate {parent_url}",
        "open a new page (sidebar New page button, Meta/Ctrl+N fallback)",
        f"type title '{title}'",
        *[f"type body paragraph ({len(p)} chars)" for p in paragraphs],
        *[f"type to-do item '{item}'" for item in todo_items],
        "wait for auto-save and extract the new page URL",
    ]
    if ctx.dry_run:
        return SiteToolResult(ok=True, summary=f"dry-run: would create Notion page '{title}'", data={"steps": plan})

    page = _require_page(ctx)
    await page.goto(parent_url, wait_until="domcontentloaded")
    await page.wait_for_selector("nav[aria-label='Sidebar'], div[data-block-id]", timeout=20_000)
    try:
        await page.locator("div.notion-sidebar-container div[role='button'][aria-label='New page']").click(timeout=5_000)
    except Exception:
        await page.keyboard.press("Meta+N")
    await page.wait_for_selector("div.notion-page-content", timeout=10_000)
    await page.locator("div[placeholder='Untitled']").click()
    await page.locator("div[placeholder='Untitled']").fill(title)
    await page.keyboard.press("Enter")
    for paragraph in paragraphs:
        await page.locator("div.notion-page-content").fill(paragraph)
        await page.keyboard.press("Enter")
    for item in todo_items:
        await page.locator("div.notion-page-content").fill(f"[ ] {item}")
        await page.keyboard.press("Enter")
    await page.wait_for_timeout(1_500)
    new_page_url = await page.evaluate("(() => window.location.href)()")
    return SiteToolResult(
        ok=True,
        summary=f"Notion page '{title}' created",
        data={"title": title, "newPageUrl": new_page_url if isinstance(new_page_url, str) else None, "parentUrl": parent_url},
    )


def create_notion_site_tools(
    manifest: PluginManifest,
    loader: Optional[PluginLoader] = None,
) -> List[SiteTool]:
    if manifest.id != "notion":
        raise ValueError(f"Expected the notion plugin manifest, got '{manifest.id}'")
    goal = "Create a new Notion page with a title, structured content, and a to-do checklist."
    if loader is not None:
        goal = read_cookbook_section(loader.load_cookbook(manifest, "create-page") or "", "Goal") or goal

    return [
        SiteTool(
            descriptor=SiteToolDescriptor(
                name="notion.create_page",
                description=(
                    f"{goal} Page creation is a destructive action per plugin "
                    "policy; the operator approval gate is the caller's responsibility."
                ),
                input_schema={
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "Page title"},
                        "parentUrl": {"type": "string", "description": "Parent page/workspace URL"},
                        "paragraphs": {"type": "array", "items": {"type": "string"}},
                        "todoItems": {"type": "array", "items": {"type": "string"}},
                        "requestedAction": {"type": "string", "enum": ["create_notion_page"]},
                    },
                    "required": ["title"],
                    "additionalProperties": False,
                },
            ),
            allowed_domains=list(manifest.policy_profile.get("allowed_domains", [])),
            blocked_actions=list(manifest.policy_profile.get("blocked_actions", [])),
            actions=["create_notion_page"],
            handler=_notion_create_page,
        ),
    ]


# ---------------------------------------------------------------------------
# Default loader — pulls manifests through the existing plugins package
# ---------------------------------------------------------------------------

_FACTORIES = {
    "gmail": create_gmail_site_tools,
    "github": create_github_site_tools,
    "notion": create_notion_site_tools,
}


def load_default_site_tools(
    plugin_ids: tuple = ("gmail", "github", "notion"),
    registry: Optional[PluginRegistry] = None,
) -> List[SiteTool]:
    """Load site tools for the given plugins via the shared PluginRegistry.

    Manifests (and therefore allowed_domains / blocked_actions policy) come
    from plugins/<id>/plugin.json through PluginRegistry.discover() — the same
    loading path every other plugin consumer uses.
    """
    registry = registry or PluginRegistry()
    registry.discover()
    loader = PluginLoader()
    tools: List[SiteTool] = []
    for plugin_id in plugin_ids:
        manifest = registry.get(plugin_id)
        if manifest is None:
            raise ValueError(f"Plugin '{plugin_id}' not found under {registry._plugins_dir}")
        factory = _FACTORIES[plugin_id]
        tools.extend(factory(manifest, loader))
    return tools

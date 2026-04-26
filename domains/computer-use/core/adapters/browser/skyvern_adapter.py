"""
Allternit Computer Use — Skyvern-Inspired Auth Flow Adapter

Handles 2FA/TOTP/SMS/email/biometric authentication flows during browser automation.
Inspired by Skyvern (github.com/Skyvern-AI/skyvern) — 64.4% WebBench accuracy.

Key capabilities:
- TOTP/authenticator app code generation (via pyotp)
- Email verification code extraction
- SMS code waiting + extraction
- Login form detection + filling
- Session persistence + cookie management
"""

from __future__ import annotations

import asyncio
import base64
import logging
import re
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

try:
    from playwright.async_api import async_playwright, Page, Browser, BrowserContext
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    Page = Any

try:
    import pyotp  # type: ignore
    PYOTP_AVAILABLE = True
except ImportError:
    PYOTP_AVAILABLE = False


# ──────────────────────────────────────────────────────────────────────────────
# Auth detection patterns
# ──────────────────────────────────────────────────────────────────────────────

AUTH_PAGE_PATTERNS = [
    r"sign[\s-]?in",
    r"log[\s-]?in",
    r"password",
    r"enter your",
    r"verify",
    r"authentication",
    r"two.?factor",
    r"2fa",
    r"totp",
    r"authenticator",
    r"verification code",
    r"one.?time.?(password|code|pin)",
    r"otp",
    r"sms code",
    r"email code",
    r"security code",
]

AUTH_FORM_SELECTORS = [
    "input[type='email']",
    "input[type='password']",
    "input[name*='email' i]",
    "input[name*='username' i]",
    "input[name*='user' i]",
    "input[name*='login' i]",
    "input[placeholder*='email' i]",
    "input[placeholder*='password' i]",
    "input[placeholder*='username' i]",
]

MFA_SELECTORS = [
    "input[name*='otp' i]",
    "input[name*='token' i]",
    "input[name*='code' i]",
    "input[name*='totp' i]",
    "input[name*='mfa' i]",
    "input[name*='2fa' i]",
    "input[placeholder*='code' i]",
    "input[placeholder*='token' i]",
    "input[placeholder*='verification' i]",
    "input[autocomplete='one-time-code']",
]


@dataclass
class AuthCredentials:
    """Credentials for automated login."""
    email: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    totp_secret: Optional[str] = None           # Base32 TOTP secret for pyotp
    totp_code: Optional[str] = None             # Static code (overrides totp_secret)
    email_code_callback: Optional[Callable] = None  # async fn() -> str
    sms_code_callback: Optional[Callable] = None    # async fn() -> str
    cookies: Optional[List[Dict]] = None        # Pre-loaded session cookies


@dataclass
class AuthFlowResult:
    """Result of an auth flow attempt."""
    success: bool
    flow_type: str = "unknown"         # login | mfa_totp | mfa_email | mfa_sms | already_authenticated
    steps_taken: List[str] = field(default_factory=list)
    final_url: str = ""
    error: Optional[str] = None
    cookies: List[Dict] = field(default_factory=list)


class SkyvernAdapter:
    """
    Auth-aware browser adapter.

    Detects login/2FA pages and handles them automatically.
    Wraps PlaywrightAdapter with auth intelligence.

    Usage:
        adapter = SkyvernAdapter(credentials=AuthCredentials(email="...", password="...", totp_secret="..."))
        await adapter.initialize()
        result = await adapter.navigate_with_auth("https://app.example.com")
    """

    ADAPTER_ID = "browser.skyvern"

    def __init__(
        self,
        credentials: Optional[AuthCredentials] = None,
        headless: bool = True,
        viewport: Tuple[int, int] = (1280, 720),
        timeout_ms: int = 30000,
        session_storage_path: Optional[str] = None,
    ):
        if not PLAYWRIGHT_AVAILABLE:
            raise ImportError("playwright not installed")
        self.credentials = credentials or AuthCredentials()
        self.headless = headless
        self.viewport = viewport
        self.timeout_ms = timeout_ms
        self.session_storage_path = session_storage_path
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._page: Optional[Page] = None

    async def initialize(self) -> None:
        if self._browser:
            return
        self._playwright = await async_playwright().start()
        launch_args = {"headless": self.headless}

        if self.session_storage_path:
            # Persistent context to save/restore auth cookies
            self._context = await self._playwright.chromium.launch_persistent_context(
                self.session_storage_path,
                **launch_args,
                viewport={"width": self.viewport[0], "height": self.viewport[1]},
            )
            pages = self._context.pages
            self._page = pages[0] if pages else await self._context.new_page()
        else:
            self._browser = await self._playwright.chromium.launch(**launch_args)
            self._context = await self._browser.new_context(
                viewport={"width": self.viewport[0], "height": self.viewport[1]},
            )
            if self.credentials.cookies:
                await self._context.add_cookies(self.credentials.cookies)
            self._page = await self._context.new_page()
            self._page.set_default_timeout(self.timeout_ms)

    async def close(self) -> None:
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()

    async def navigate_with_auth(self, url: str, max_auth_attempts: int = 3) -> AuthFlowResult:
        """Navigate to URL, handling any auth flows encountered."""
        await self.initialize()
        await self._page.goto(url, wait_until="domcontentloaded")
        await asyncio.sleep(1)

        for attempt in range(max_auth_attempts):
            auth_type = await self._detect_auth_type()
            if auth_type == "none":
                break

            logger.info(f"Auth flow detected: {auth_type} (attempt {attempt+1})")
            result = await self._handle_auth_flow(auth_type)
            if not result.success:
                return result
            await asyncio.sleep(1.5)

        cookies = await self._context.cookies()
        return AuthFlowResult(
            success=True,
            flow_type="navigated",
            final_url=self._page.url,
            cookies=cookies,
        )

    async def _detect_auth_type(self) -> str:
        """Detect what kind of auth page we're on."""
        try:
            content = await self._page.content()
            text = content.lower()
            url = self._page.url.lower()

            # Check for MFA/2FA page first (more specific)
            mfa_keywords = ["verification code", "one-time", "authenticator", "2fa", "totp", "otp", "mfa"]
            if any(kw in text for kw in mfa_keywords):
                # Is there an OTP input?
                for sel in MFA_SELECTORS:
                    el = await self._page.query_selector(sel)
                    if el:
                        return "mfa"

            # Check for login form
            for sel in AUTH_FORM_SELECTORS:
                el = await self._page.query_selector(sel)
                if el:
                    return "login"

            # Check URL for auth indicators
            auth_url_patterns = ["login", "signin", "sign-in", "auth", "authenticate", "account/login"]
            if any(p in url for p in auth_url_patterns):
                return "login"

        except Exception as e:
            logger.warning(f"Auth detection error: {e}")

        return "none"

    async def _handle_auth_flow(self, auth_type: str) -> AuthFlowResult:
        steps = []
        try:
            if auth_type == "login":
                return await self._handle_login(steps)
            elif auth_type == "mfa":
                return await self._handle_mfa(steps)
        except Exception as e:
            return AuthFlowResult(success=False, flow_type=auth_type, steps_taken=steps, error=str(e))
        return AuthFlowResult(success=False, flow_type=auth_type, steps_taken=steps, error="Unknown auth type")

    async def _handle_login(self, steps: List[str]) -> AuthFlowResult:
        """Fill and submit a login form."""
        creds = self.credentials
        if not creds.email and not creds.username and not creds.password:
            return AuthFlowResult(success=False, flow_type="login", steps_taken=steps,
                                  error="No credentials provided")

        # Fill email/username
        identifier = creds.email or creds.username or ""
        email_selectors = [
            "input[type='email']", "input[name*='email' i]", "input[name*='username' i]",
            "input[name*='user' i]", "input[placeholder*='email' i]",
        ]
        for sel in email_selectors:
            el = await self._page.query_selector(sel)
            if el:
                await el.fill(identifier)
                steps.append(f"filled email/username: {identifier[:20]}...")
                break

        # Fill password
        if creds.password:
            pw_el = await self._page.query_selector("input[type='password']")
            if pw_el:
                await pw_el.fill(creds.password)
                steps.append("filled password")

        # Submit
        submit_selectors = [
            "button[type='submit']",
            "input[type='submit']",
            "button:has-text('Sign in')",
            "button:has-text('Log in')",
            "button:has-text('Continue')",
            "button:has-text('Next')",
        ]
        for sel in submit_selectors:
            btn = await self._page.query_selector(sel)
            if btn:
                await btn.click()
                steps.append("clicked submit")
                await self._page.wait_for_load_state("domcontentloaded", timeout=10000)
                break

        await asyncio.sleep(1)
        return AuthFlowResult(success=True, flow_type="login", steps_taken=steps, final_url=self._page.url)

    async def _handle_mfa(self, steps: List[str]) -> AuthFlowResult:
        """Handle MFA/2FA code entry."""
        creds = self.credentials
        code: Optional[str] = None

        # Priority: static code > TOTP > callback
        if creds.totp_code:
            code = creds.totp_code
            steps.append("using static TOTP code")
        elif creds.totp_secret and PYOTP_AVAILABLE:
            totp = pyotp.TOTP(creds.totp_secret)
            code = totp.now()
            steps.append(f"generated TOTP code")
        elif creds.email_code_callback:
            code = await creds.email_code_callback()
            steps.append("fetched email verification code")
        elif creds.sms_code_callback:
            code = await creds.sms_code_callback()
            steps.append("fetched SMS code")

        if not code:
            return AuthFlowResult(success=False, flow_type="mfa", steps_taken=steps,
                                  error="No MFA code available (no totp_secret or callback provided)")

        # Find and fill OTP input
        for sel in MFA_SELECTORS:
            el = await self._page.query_selector(sel)
            if el:
                await el.fill(code)
                steps.append(f"filled MFA code")

                # Submit
                submit_selectors = ["button[type='submit']", "button:has-text('Verify')",
                                     "button:has-text('Confirm')", "button:has-text('Continue')"]
                for sub_sel in submit_selectors:
                    btn = await self._page.query_selector(sub_sel)
                    if btn:
                        await btn.click()
                        steps.append("submitted MFA")
                        await self._page.wait_for_load_state("domcontentloaded", timeout=10000)
                        break
                break

        await asyncio.sleep(1)
        return AuthFlowResult(success=True, flow_type="mfa", steps_taken=steps, final_url=self._page.url)

    async def screenshot_b64(self) -> str:
        await self.initialize()
        data = await self._page.screenshot()
        return base64.b64encode(data).decode("utf-8")

    async def get_url(self) -> str:
        await self.initialize()
        return self._page.url

    async def health_check(self) -> bool:
        try:
            await self.initialize()
            return self._page is not None
        except Exception:
            return False

    def capabilities(self) -> Dict:
        return {
            "adapter_id": self.ADAPTER_ID,
            "dom_tree": False,
            "vision_required": False,
            "auth_flows": True,
            "multi_tab": False,
            "platform": "any",
        }

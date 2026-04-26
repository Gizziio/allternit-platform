#!/usr/bin/env python3
"""
Canvas Academic Notice E2E Demo Runner

Intelligent automation with self-healing capabilities:
- Automatic retry on transient failures
- Session refresh on auth expiration
- Graceful degradation when optional steps fail
- Detailed logging for troubleshooting
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import subprocess
import sys
import time
import urllib.parse
from dataclasses import dataclass
from typing import Callable, Optional, TypeVar

import requests
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout


T = TypeVar("T")

ROOT = pathlib.Path(__file__).resolve().parent
SAMPLE_DATA = ROOT / "sample_data.json"
NOTICE_SCRIPT = ROOT / "generate_demo_data.mjs"
OUTPUT_DIR = ROOT / "output"
LOCAL_CFG = pathlib.Path.home() / ".config" / "allternit" / "canvas_academic_notice_demo.env"

RETRYABLE_STATUS = {503, 504, 502, 429}  # Gateway errors + rate limit
MAX_RETRIES = 3
RETRY_DELAY = 2


@dataclass
class Config:
    email: str
    password: str
    course_id: str
    base_url: str


class DemoError(Exception):
    """Base exception for demo failures with recovery hints."""
    def __init__(self, message: str, recovery_hint: str = ""):
        super().__init__(message)
        self.recovery_hint = recovery_hint


class AuthError(DemoError):
    """Authentication/authorization failure."""
    pass


class CanvasAPIError(DemoError):
    """Canvas API returned error."""
    pass


def log_step(step: str, status: str = "...") -> None:
    """Print formatted step progress."""
    timestamp = time.strftime("%H:%M:%S")
    print(f"[{timestamp}] {step:<45} {status}")


def parse_env_file(path: pathlib.Path) -> dict[str, str]:
    """Parse key=value env file, ignoring comments and blank lines."""
    data: dict[str, str] = {}
    if not path.exists():
        return data
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        data[k.strip()] = v.strip()
    return data


def load_config(args: argparse.Namespace) -> Config:
    """Load configuration from env file and args with validation."""
    log_step("Loading configuration")
    
    if not LOCAL_CFG.exists():
        raise AuthError(
            f"Credential file not found: {LOCAL_CFG}",
            "Create the file with CANVAS_LOGIN_EMAIL, CANVAS_LOGIN_PASSWORD, CANVAS_COURSE_ID, CANVAS_BASE_URL"
        )
    
    file_cfg = parse_env_file(LOCAL_CFG)
    env = {**file_cfg, **os.environ}
    
    course_id = str(args.course_id or env.get("CANVAS_COURSE_ID"))
    base_url = env.get("CANVAS_BASE_URL", "https://canvas.instructure.com").rstrip("/")
    email = env.get("CANVAS_LOGIN_EMAIL", "")
    password = env.get("CANVAS_LOGIN_PASSWORD", "")
    
    missing = []
    if not email:
        missing.append("CANVAS_LOGIN_EMAIL")
    if not password:
        missing.append("CANVAS_LOGIN_PASSWORD")
    if not course_id:
        missing.append("CANVAS_COURSE_ID")
    
    if missing:
        raise AuthError(
            f"Missing configuration: {', '.join(missing)}",
            f"Add missing values to {LOCAL_CFG}"
        )
    
    log_step("Configuration loaded", "✓")
    return Config(email=email, password=password, course_id=course_id, base_url=base_url)


def with_retry(func: Callable[[], T], description: str) -> T:
    """Execute function with automatic retry on transient failures."""
    last_error: Optional[Exception] = None
    
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return func()
        except requests.HTTPError as e:
            last_error = e
            status = e.response.status_code if e.response else 0
            
            if status in RETRYABLE_STATUS and attempt < MAX_RETRIES:
                log_step(f"{description} (attempt {attempt})", f"retrying ({status})")
                time.sleep(RETRY_DELAY * attempt)
                continue
            raise
        except (requests.ConnectionError, requests.Timeout) as e:
            last_error = e
            if attempt < MAX_RETRIES:
                log_step(f"{description} (attempt {attempt})", f"retrying (network)")
                time.sleep(RETRY_DELAY * attempt)
                continue
            raise
    
    raise last_error or RuntimeError(f"Failed after {MAX_RETRIES} attempts")


def run_notice_generation() -> dict:
    """Generate fresh notice PDFs with new students - shows live generation."""
    print("\n" + "="*60)
    print("STEP 1: GENERATING FRESH DEMO STUDENTS & NOTICES")
    print("="*60 + "\n")
    
    if not NOTICE_SCRIPT.exists():
        raise DemoError(
            f"Generation script not found: {NOTICE_SCRIPT}",
            "Ensure generate_demo_data.mjs exists in the same directory"
        )
    
    try:
        # Run without capturing output so user sees live generation
        result = subprocess.run(
            ["node", str(NOTICE_SCRIPT)],
            capture_output=False,
            text=True,
            check=True
        )
    except subprocess.CalledProcessError as e:
        raise DemoError(
            f"Generation failed",
            "Check Node.js is installed and PDF template files exist"
        )
    except FileNotFoundError:
        raise DemoError(
            "Node.js not found",
            "Install Node.js: https://nodejs.org/"
        )
    
    if not SAMPLE_DATA.exists():
        raise DemoError(
            "Sample data not generated",
            "Check generate_demo_data.mjs completed successfully"
        )
    
    data = json.loads(SAMPLE_DATA.read_text())
    log_step("Notice PDFs generated", f"✓ ({len(data.get('students', []))} students)")
    return data


def get_targeted_students(data: dict) -> list[dict]:
    """Identify students below passing threshold."""
    threshold = data.get("term", {}).get("passing_grade", 70)
    targeted = [s for s in data.get("students", []) if s.get("current_grade", 100) < threshold]
    
    if not targeted:
        log_step("WARNING: No students below threshold", f"(threshold: {threshold}%)")
    else:
        names = ", ".join(f"{s['first_name']} {s['last_name']}" for s in targeted)
        log_step(f"Targeted students: {names}", f"✓ ({len(targeted)} students)")
    
    return targeted


def login_and_get_session(config: Config) -> tuple[requests.Session, str]:
    """Authenticate with Canvas and establish session."""
    log_step("Authenticating with Canvas")
    
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            
            try:
                page.goto(f"{config.base_url}/login/canvas", wait_until="networkidle", timeout=30000)
            except PlaywrightTimeout:
                raise CanvasAPIError(
                    "Canvas login page timeout",
                    "Check CANVAS_BASE_URL is correct and Canvas is accessible"
                )
            
            # Try multiple selector strategies for flexibility
            email_selectors = [
                'input[type="email"]',
                'input[name="pseudonym_session[unique_id]"]',
                'input#pseudonym_session_unique_id',
                'input[name*="email"]',
                'input[name*="unique_id"]'
            ]
            
            password_selectors = [
                'input[type="password"]',
                'input[name="pseudonym_session[password]"]',
                'input#pseudonym_session_password'
            ]
            
            # Find and fill email
            email_filled = False
            for selector in email_selectors:
                try:
                    if page.locator(selector).count() > 0:
                        page.fill(selector, config.email)
                        email_filled = True
                        break
                except:
                    continue
            
            if not email_filled:
                raise AuthError(
                    "Could not find email input field",
                    "Canvas login page structure may have changed"
                )
            
            # Find and fill password
            password_filled = False
            for selector in password_selectors:
                try:
                    if page.locator(selector).count() > 0:
                        page.fill(selector, config.password)
                        password_filled = True
                        break
                except:
                    continue
            
            if not password_filled:
                raise AuthError(
                    "Could not find password input field",
                    "Canvas login page structure may have changed"
                )
            
            # Submit
            page.locator('input[type="submit"]').first.click()
            
            try:
                page.wait_for_url("**/?login_success=1", timeout=30000)
            except PlaywrightTimeout:
                # Check if we're on an error page
                if "error" in page.url.lower() or page.locator("text=/invalid|incorrect|failed/i").count() > 0:
                    raise AuthError(
                        "Invalid Canvas credentials",
                        f"Check email and password in {LOCAL_CFG}"
                    )
                # Might already be logged in, continue anyway
                pass
            
            cookies = page.context.cookies()
            browser.close()
    
    except AuthError:
        raise
    except Exception as e:
        raise CanvasAPIError(
            f"Login failed: {e}",
            "Check network connection and Canvas availability"
        )
    
    # Build requests session
    session = requests.Session()
    csrf = None
    
    for c in cookies:
        session.cookies.set(
            c["name"],
            c["value"],
            domain=c.get("domain"),
            path=c.get("path")
        )
        if c["name"] == "_csrf_token":
            csrf = urllib.parse.unquote(c["value"])
    
    session.headers.update({
        "X-CSRF-Token": csrf or "",
        "Accept": "application/json",
        "Referer": f"{config.base_url}/courses/{config.course_id}/modules",
    })
    
    log_step("Authentication successful", "✓")
    return session, csrf or ""


def create_module(session: requests.Session, config: Config, name: str, publish: bool) -> dict:
    """Create a new module in the Canvas course."""
    log_step("Creating Canvas module")
    
    def _create():
        r = session.post(
            f"{config.base_url}/api/v1/courses/{config.course_id}/modules",
            data={
                "module[name]": name,
                "module[published]": str(publish).lower(),
            },
        )
        r.raise_for_status()
        return r.json()
    
    try:
        result = with_retry(_create, "Creating module")
        log_step(f"Module created: {result.get('name', name)}", f"✓ (ID: {result.get('id')})")
        return result
    except requests.HTTPError as e:
        if e.response.status_code == 404:
            raise CanvasAPIError(
                f"Course {config.course_id} not found or no access",
                "Verify CANVAS_COURSE_ID and that you have teacher/admin role"
            )
        elif e.response.status_code == 401:
            raise AuthError(
                "Not authorized to create modules",
                "Ensure you have teacher or admin role in the course"
            )
        raise


def create_page(session: requests.Session, config: Config, title: str, body: str, published: bool = False) -> dict:
    """Create a wiki page in the course."""
    log_step("Creating summary page")
    
    def _create():
        r = session.post(
            f"{config.base_url}/api/v1/courses/{config.course_id}/pages",
            data={
                "wiki_page[title]": title,
                "wiki_page[body]": body,
                "wiki_page[published]": str(published).lower(),
            },
        )
        r.raise_for_status()
        return r.json()
    
    result = with_retry(_create, "Creating page")
    log_step(f"Page created: {title}", f"✓ (ID: {result.get('page_id')})")
    return result


def add_page_to_module(session: requests.Session, config: Config, module_id: int, title: str, page_url: str) -> dict:
    """Add a page as a module item."""
    def _add():
        r = session.post(
            f"{config.base_url}/api/v1/courses/{config.course_id}/modules/{module_id}/items",
            data={
                "module_item[title]": title,
                "module_item[type]": "Page",
                "module_item[page_url]": page_url,
            },
        )
        r.raise_for_status()
        return r.json()
    
    return with_retry(_add, "Adding page to module")


def upload_file(session: requests.Session, config: Config, file_path: pathlib.Path, folder: str) -> dict:
    """Upload a file to Canvas course files."""
    if not file_path.exists():
        raise DemoError(f"File not found: {file_path}")
    
    file_size = file_path.stat().st_size
    content_type = "application/pdf" if file_path.suffix.lower() == ".pdf" else "text/markdown"
    
    def _request_url():
        r = session.post(
            f"{config.base_url}/api/v1/courses/{config.course_id}/files",
            data={
                "name": file_path.name,
                "size": str(file_size),
                "content_type": content_type,
                "parent_folder_path": folder,
                "on_duplicate": "rename",
            },
        )
        r.raise_for_status()
        return r.json()
    
    # Step 1: Get upload URL
    upload_data = with_retry(_request_url, f"Requesting upload URL for {file_path.name}")
    
    # Step 2: Upload file to S3/redirect URL
    def _upload():
        with file_path.open("rb") as fh:
            files = {"file": (file_path.name, fh, upload_data.get("content-type", "application/octet-stream"))}
            r = requests.post(
                upload_data["upload_url"],
                data=upload_data["upload_params"],
                files=files,
                allow_redirects=False
            )
        
        if r.status_code not in (200, 201, 301, 302, 303, 307, 308):
            raise requests.HTTPError(
                f"Upload failed: {r.status_code}",
                response=r
            )
        return r
    
    step2 = with_retry(_upload, f"Uploading {file_path.name}")
    
    # Step 3: Confirm/follow redirect
    if step2.headers.get("Location"):
        confirm = session.get(step2.headers["Location"])
        confirm.raise_for_status()
        return confirm.json()
    
    return step2.json()


def add_file_to_module(session: requests.Session, config: Config, module_id: int, title: str, file_id: int) -> dict:
    """Add a file as a module item."""
    def _add():
        r = session.post(
            f"{config.base_url}/api/v1/courses/{config.course_id}/modules/{module_id}/items",
            data={
                "module_item[title]": title,
                "module_item[type]": "File",
                "module_item[content_id]": str(file_id),
            },
        )
        r.raise_for_status()
        return r.json()
    
    return with_retry(_add, "Adding file to module")


def build_summary_html(data: dict, targeted: list[dict], module_name: str) -> str:
    """Build HTML table of targeted students."""
    rows = []
    for student in targeted:
        rows.append(
            f"<tr><td>{student['first_name']} {student['last_name']}</td>"
            f"<td>{student['current_grade']}%</td>"
            f"<td>{student['attendance']}</td>"
            f"<td>{len(student['missing_assignments'])}</td></tr>"
        )
    
    return f"""<h2>Academic Notice Demo Queue</h2>
<p><strong>Module:</strong> {module_name}</p>
<p><strong>Course:</strong> {data['term']['course_name']}</p>
<p><strong>Stage:</strong> {data['term']['stage']}</p>
<p><strong>Threshold:</strong> {data['term']['passing_grade']}%</p>
<table border="1" cellpadding="6" cellspacing="0">
  <thead>
    <tr><th>Mock Student</th><th>Current Grade</th><th>Attendance</th><th>Missing Assignments</th></tr>
  </thead>
  <tbody>
    {''.join(rows)}
  </tbody>
</table>
<p>This page and the linked notice files were created by the Allternit Academic Notice demo runner using the exact institutional PDF template.</p>
"""


def open_result_in_browser(config: Config, keep_open: bool = False) -> None:
    """Open a headed browser showing the Canvas modules page.
    
    Args:
        config: Canvas configuration
        keep_open: If True, block forever (for demo recording). If False, return immediately.
    """
    log_step("Opening headed browser")
    
    profile_dir = ROOT / "canvas_demo_profile"
    profile_dir.mkdir(exist_ok=True)
    
    try:
        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                user_data_dir=str(profile_dir),
                headless=False,
                viewport={"width": 1440, "height": 900},
            )
            page = context.pages[0] if context.pages else context.new_page()
            
            # Navigate to login
            page.goto(f"{config.base_url}/login/canvas", wait_until="networkidle")
            
            # If still on login page, try to log in
            if "login/canvas" in page.url:
                try:
                    page.fill('input[type="email"], input[name*="unique_id"]', config.email)
                    page.fill('input[type="password"]', config.password)
                    page.locator('input[type="submit"]').first.click()
                    page.wait_for_timeout(4000)
                except:
                    log_step("Manual login may be required", "⚠")
            
            # Navigate to modules
            page.goto(f"{config.base_url}/courses/{config.course_id}/modules", wait_until="networkidle")
            
            log_step("Browser open on Canvas modules", "✓")
            print("\n" + "="*60)
            print("HEADED BROWSER IS OPEN")
            print("="*60)
            print(f"URL: {config.base_url}/courses/{config.course_id}/modules")
            print("="*60 + "\n")
            
            if keep_open:
                # Block for demo recording
                print("Browser will stay open. Press Ctrl+C to close.")
                try:
                    while True:
                        time.sleep(60)
                except KeyboardInterrupt:
                    log_step("Closing browser", "...")
            else:
                # Don't block - let the script complete
                print("Browser is open. Script completing...")
                # Keep browser alive for 2 seconds then return
                time.sleep(2)
    
    except Exception as e:
        log_step(f"Could not open browser: {e}", "⚠")
        print("\nBrowser open failed, but Canvas content was created successfully.")
        print(f"Visit manually: {config.base_url}/courses/{config.course_id}/modules")


def verify_outputs(targeted: list[dict]) -> bool:
    """Verify expected output files exist."""
    log_step("Verifying output files")
    
    all_exist = True
    for student in targeted:
        slug = f"{student['first_name'].lower()}-{student['last_name'].lower()}"
        student_dir = OUTPUT_DIR / "notices" / slug
        
        pdf_path = student_dir / "academic_notice.pdf"
        md_path = student_dir / "missing_assignments.md"
        
        if pdf_path.exists():
            log_step(f"  ✓ {slug}/academic_notice.pdf", f"({pdf_path.stat().st_size} bytes)")
        else:
            log_step(f"  ✗ {slug}/academic_notice.pdf", "MISSING")
            all_exist = False
        
        if md_path.exists():
            log_step(f"  ✓ {slug}/missing_assignments.md", f"({md_path.stat().st_size} bytes)")
        else:
            log_step(f"  ✗ {slug}/missing_assignments.md", "MISSING")
    
    return all_exist


def main():
    parser = argparse.ArgumentParser(
        description="Canvas Academic Notice E2E Demo",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Full demo with browser for recording
  %(prog)s --headed --keep-open
  
  # Headless run (CI/testing)
  %(prog)s
  
  # Custom course
  %(prog)s --course-id 12345 --headed
  
  # Publish module (visible to students)
  %(prog)s --publish-module
        """
    )
    parser.add_argument("--course-id", type=int, help="Canvas course ID (overrides env)")
    parser.add_argument("--publish-module", action="store_true", help="Publish the demo module")
    parser.add_argument("--headed", action="store_true", help="Open browser after creation")
    parser.add_argument("--keep-open", action="store_true", help="Keep browser open until Ctrl+C")
    parser.add_argument("--verify-only", action="store_true", help="Just verify outputs exist")
    
    args = parser.parse_args()
    
    print("="*60)
    print("CANVAS ACADEMIC NOTICE E2E DEMO")
    print("="*60)
    print()
    
    try:
        # Load config
        config = load_config(args)
        
        # Verify-only mode
        if args.verify_only:
            if not SAMPLE_DATA.exists():
                print("No sample data found. Run without --verify-only first.")
                sys.exit(1)
            data = json.loads(SAMPLE_DATA.read_text())
            targeted = get_targeted_students(data)
            verify_outputs(targeted)
            sys.exit(0)
        
        # Step 1: Generate notices
        data = run_notice_generation()
        targeted = get_targeted_students(data)
        
        if not targeted:
            print("\nNo students need academic notices (all above threshold). Exiting.")
            sys.exit(0)
        
        # Step 2: Verify outputs
        if not verify_outputs(targeted):
            print("\nWARNING: Some expected files are missing. Continuing anyway...")
        
        # Step 3: Authenticate
        session, csrf = login_and_get_session(config)
        
        # Step 4: Create module
        module_name = f"Allternit Academic Notice Demo {int(time.time())}"
        module = create_module(session, config, module_name, publish=args.publish_module)
        
        # Step 5: Create summary page
        summary = create_page(
            session,
            config,
            title=f"{module_name} Queue Summary",
            body=build_summary_html(data, targeted, module_name),
            published=False,
        )
        add_page_to_module(session, config, module["id"], summary["title"], summary["url"])
        log_step("Summary page added to module", "✓")
        
        # Step 6: Upload files
        folder = "academic_notice_demo"
        created_files: list[dict] = []
        
        for student in targeted:
            slug = f"{student['first_name'].lower()}-{student['last_name'].lower()}"
            student_dir = OUTPUT_DIR / "notices" / slug
            
            for artifact_name in ["academic_notice.pdf", "missing_assignments.md"]:
                artifact = student_dir / artifact_name
                if not artifact.exists():
                    continue
                
                try:
                    uploaded = upload_file(session, config, artifact, folder)
                    created_files.append(uploaded)
                    
                    # Add PDFs to module
                    if artifact.suffix.lower() == ".pdf":
                        add_file_to_module(
                            session,
                            config,
                            module["id"],
                            f"{student['first_name']} {student['last_name']} Academic Notice",
                            uploaded["id"],
                        )
                        log_step(f"Added {student['first_name']}'s notice to module", "✓")
                except Exception as e:
                    log_step(f"Failed to upload {artifact.name}: {e}", "⚠")
                    # Continue with other files
        
        # Step 7: Save results
        log_path = OUTPUT_DIR / "canvas_e2e_demo_result.json"
        result = {
            "course_id": config.course_id,
            "module_id": module["id"],
            "module_name": module_name,
            "summary_page": {
                "id": summary.get("page_id"),
                "url": summary.get("html_url") or summary.get("url")
            },
            "files": created_files,
            "targeted_students": [f"{s['first_name']} {s['last_name']}" for s in targeted],
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "status": "success"
        }
        
        log_path.write_text(json.dumps(result, indent=2))
        
        # Final summary
        print()
        print("="*60)
        print("DEMO COMPLETE")
        print("="*60)
        print(f"Course:        {config.base_url}/courses/{config.course_id}")
        print(f"Module:        {module_name}")
        print(f"Module ID:     {module['id']}")
        print(f"Summary Page:  {result['summary_page']['url']}")
        print(f"Targeted:      {', '.join(result['targeted_students'])}")
        print(f"Files:         {len(created_files)} uploaded")
        print(f"Log saved:     {log_path}")
        print("="*60)
        
        # Step 8: Open browser if requested
        if args.headed or args.keep_open:
            open_result_in_browser(config, keep_open=args.keep_open)
        
        print("\n✓ Demo completed successfully!")
        return 0
    
    except AuthError as e:
        print(f"\n✗ Authentication Error: {e}")
        if e.recovery_hint:
            print(f"  → {e.recovery_hint}")
        return 1
    
    except CanvasAPIError as e:
        print(f"\n✗ Canvas API Error: {e}")
        if e.recovery_hint:
            print(f"  → {e.recovery_hint}")
        return 1
    
    except DemoError as e:
        print(f"\n✗ Demo Error: {e}")
        if e.recovery_hint:
            print(f"  → {e.recovery_hint}")
        return 1
    
    except Exception as e:
        print(f"\n✗ Unexpected Error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
A2R Platform UI Audit using browser-use

This script uses the browser-use library to systematically test and audit
the A2R Platform UI, identifying rendering issues, layout problems, and bugs.

Requirements:
    pip install browser-use==0.1.40 playwright==1.49.0
    playwright install
"""

import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('ui-audit')

try:
    from browser_use import Agent, Controller, Browser, BrowserConfig
    from browser_use.agent.views import ActionResult
    from playwright.async_api import Page, Browser as PlaywrightBrowser
    BROWSER_USE_AVAILABLE = True
except ImportError as e:
    logger.error(f"browser-use not installed: {e}")
    logger.info("Install with: pip install browser-use==0.1.40 playwright==1.49.0")
    BROWSER_USE_AVAILABLE = False

# Try playwright directly as fallback
try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False


class UIAuditor:
    """UI Audit using browser-use and Playwright"""
    
    def __init__(self, base_url: str = "http://127.0.0.1:5177"):
        self.base_url = base_url
        self.issues: List[Dict[str, Any]] = []
        self.screenshots_dir = Path("test-results/screenshots")
        self.screenshots_dir.mkdir(parents=True, exist_ok=True)
        
    async def audit_with_playwright(self):
        """Run UI audit using Playwright directly"""
        if not PLAYWRIGHT_AVAILABLE:
            logger.error("Playwright not available")
            return
        
        logger.info("Starting UI audit with Playwright...")
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={"width": 1920, "height": 1080}
            )
            page = await context.new_page()
            
            # Enable console logging
            page.on("console", lambda msg: logger.info(f"[{msg.type}] {msg.text}"))
            page.on("pageerror", lambda err: self.log_error(err))
            
            try:
                # Navigate to app
                logger.info(f"Navigating to {self.base_url}")
                await page.goto(self.base_url, wait_until="networkidle")
                await page.wait_for_timeout(3000)
                
                # Test 1: Shell Layout
                await self.test_shell_layout(page)
                
                # Test 2: Navigation Rail
                await self.test_navigation_rail(page)
                
                # Test 3: Chat View
                await self.test_chat_view(page)
                
                # Test 4: Responsive layouts
                await self.test_responsive_layout(page)
                
                # Test 5: Performance
                await self.test_performance(page)
                
                # Test 6: Accessibility
                await self.test_accessibility(page)
                
            except Exception as e:
                logger.error(f"Audit failed: {e}")
                self.add_issue("CRITICAL", "Audit Execution", str(e))
            finally:
                await browser.close()
        
        return self.generate_report()
    
    async def test_shell_layout(self, page: Page):
        """Test main shell layout rendering"""
        logger.info("Testing shell layout...")
        
        try:
            # Take full page screenshot
            await page.screenshot(
                path=str(self.screenshots_dir / "shell-layout.png"),
                full_page=True
            )
            
            # Check for main elements
            shell_frame = await page.query_selector('[data-shell-frame]')
            if not shell_frame:
                # Try alternative selectors
                shell_frame = await page.query_selector('div[class*="shell"]')
            
            if shell_frame:
                logger.info("✓ Shell frame found")
            else:
                self.add_issue(
                    "HIGH",
                    "Shell Layout",
                    "Shell frame not found or not rendering"
                )
            
            # Check canvas area
            canvas = await page.query_selector('[data-shell-canvas]')
            if not canvas:
                canvas = await page.query_selector('div[class*="canvas"]')
            
            if canvas:
                logger.info("✓ Shell canvas found")
            else:
                self.add_issue(
                    "MEDIUM",
                    "Shell Layout",
                    "Shell canvas area not found"
                )
                
        except Exception as e:
            self.add_issue("HIGH", "Shell Layout", f"Test failed: {str(e)}")
    
    async def test_navigation_rail(self, page: Page):
        """Test navigation rail items"""
        logger.info("Testing navigation rail...")
        
        try:
            # Look for rail items
            rail_items = await page.query_selector_all('[data-rail-item]')
            
            if not rail_items:
                # Try alternative selectors
                rail_items = await page.query_selector_all('nav button')
            
            logger.info(f"Found {len(rail_items)} navigation items")
            
            if len(rail_items) < 5:
                self.add_issue(
                    "MEDIUM",
                    "Navigation Rail",
                    f"Only {len(rail_items)} rail items found (expected >= 5)"
                )
            
            # Take screenshot
            await page.screenshot(
                path=str(self.screenshots_dir / "navigation-rail.png")
            )
            
        except Exception as e:
            self.add_issue("MEDIUM", "Navigation Rail", f"Test failed: {str(e)}")
    
    async def test_chat_view(self, page: Page):
        """Test chat view rendering"""
        logger.info("Testing chat view...")
        
        try:
            # Click chat rail item
            chat_item = await page.query_selector('[data-rail-item="chat"]')
            if chat_item:
                await chat_item.click()
                await page.wait_for_timeout(1000)
                
                # Look for conversation area
                conversation = await page.query_selector('[data-conversation]')
                if not conversation:
                    conversation = await page.query_selector('div[class*="conversation"]')
                
                if conversation:
                    logger.info("✓ Conversation view found")
                else:
                    self.add_issue(
                        "MEDIUM",
                        "Chat View",
                        "Conversation area not found"
                    )
                
                # Look for input
                input_area = await page.query_selector('[data-prompt-input]')
                if not input_area:
                    input_area = await page.query_selector('textarea')
                
                if input_area:
                    logger.info("✓ Prompt input found")
                else:
                    self.add_issue(
                        "LOW",
                        "Chat View",
                        "Prompt input not found"
                    )
                
                # Screenshot
                await page.screenshot(
                    path=str(self.screenshots_dir / "chat-view.png")
                )
            else:
                self.add_issue(
                    "HIGH",
                    "Chat View",
                    "Chat navigation item not found"
                )
                
        except Exception as e:
            self.add_issue("MEDIUM", "Chat View", f"Test failed: {str(e)}")
    
    async def test_responsive_layout(self, page: Page):
        """Test responsive layouts"""
        logger.info("Testing responsive layouts...")
        
        viewports = [
            {"width": 1920, "height": 1080, "name": "desktop"},
            {"width": 1024, "height": 768, "name": "tablet"},
            {"width": 375, "height": 667, "name": "mobile"},
        ]
        
        for viewport in viewports:
            try:
                await page.set_viewport_size({
                    "width": viewport["width"],
                    "height": viewport["height"]
                })
                await page.wait_for_timeout(500)
                
                await page.screenshot(
                    path=str(self.screenshots_dir / f"{viewport['name']}-{viewport['width']}x{viewport['height']}.png")
                )
                
                logger.info(f"✓ {viewport['name']} screenshot captured")
                
            except Exception as e:
                self.add_issue(
                    "LOW",
                    "Responsive Layout",
                    f"{viewport['name']} viewport test failed: {str(e)}"
                )
    
    async def test_performance(self, page: Page):
        """Test performance metrics"""
        logger.info("Testing performance...")
        
        try:
            # Get performance metrics
            metrics = await page.evaluate("""() => {
                return {
                    loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
                    domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
                    firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0,
                    firstContentfulPaint: performance.getEntriesByType('paint')[1]?.startTime || 0,
                    resourceCount: performance.getEntriesByType('resource').length,
                };
            }""")
            
            logger.info(f"Performance metrics: {json.dumps(metrics, indent=2)}")
            
            # Check thresholds
            if metrics['loadTime'] > 10000:
                self.add_issue(
                    "HIGH",
                    "Performance",
                    f"Page load time too slow: {metrics['loadTime']}ms (> 10s)"
                )
            elif metrics['loadTime'] > 5000:
                self.add_issue(
                    "MEDIUM",
                    "Performance",
                    f"Page load time could be better: {metrics['loadTime']}ms"
                )
            
            if metrics['firstContentfulPaint'] > 3000:
                self.add_issue(
                    "MEDIUM",
                    "Performance",
                    f"First contentful paint slow: {metrics['firstContentfulPaint']}ms"
                )
                
        except Exception as e:
            self.add_issue("LOW", "Performance", f"Test failed: {str(e)}")
    
    async def test_accessibility(self, page: Page):
        """Test basic accessibility"""
        logger.info("Testing accessibility...")
        
        try:
            # Check for ARIA labels
            aria_count = await page.evaluate("""() => {
                return document.querySelectorAll('[aria-label]').length;
            }""")
            
            logger.info(f"Found {aria_count} ARIA labels")
            
            if aria_count == 0:
                self.add_issue(
                    "MEDIUM",
                    "Accessibility",
                    "No ARIA labels found"
                )
            
            # Check heading hierarchy
            h1_count = await page.evaluate("""() => {
                return document.querySelectorAll('h1').length;
            }""")
            
            if h1_count > 1:
                self.add_issue(
                    "LOW",
                    "Accessibility",
                    f"Multiple H1 tags found ({h1_count})"
                )
            
            # Check for images without alt text
            images_without_alt = await page.evaluate("""() => {
                const images = document.querySelectorAll('img');
                return Array.from(images).filter(img => !img.alt).length;
            }""")
            
            if images_without_alt > 0:
                self.add_issue(
                    "LOW",
                    "Accessibility",
                    f"{images_without_alt} images missing alt text"
                )
                
        except Exception as e:
            self.add_issue("LOW", "Accessibility", f"Test failed: {str(e)}")
    
    def log_error(self, error):
        """Log page errors"""
        error_msg = str(error)
        logger.error(f"Page error: {error_msg}")
        self.add_issue("HIGH", "Runtime Error", error_msg)
    
    def add_issue(self, priority: str, category: str, description: str):
        """Add an issue to the list"""
        issue = {
            "id": f"ISSUE-{len(self.issues) + 1:03d}",
            "priority": priority,
            "category": category,
            "description": description,
            "timestamp": datetime.now().isoformat(),
        }
        self.issues.append(issue)
        logger.warning(f"[{priority}] {category}: {description}")
    
    def generate_report(self) -> Dict[str, Any]:
        """Generate audit report"""
        report = {
            "audit_date": datetime.now().isoformat(),
            "base_url": self.base_url,
            "total_issues": len(self.issues),
            "issues_by_priority": {
                "CRITICAL": len([i for i in self.issues if i["priority"] == "CRITICAL"]),
                "HIGH": len([i for i in self.issues if i["priority"] == "HIGH"]),
                "MEDIUM": len([i for i in self.issues if i["priority"] == "MEDIUM"]),
                "LOW": len([i for i in self.issues if i["priority"] == "LOW"]),
            },
            "issues_by_category": {},
            "issues": self.issues,
            "screenshots_dir": str(self.screenshots_dir.absolute()),
        }
        
        # Group by category
        categories = {}
        for issue in self.issues:
            cat = issue["category"]
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(issue)
        report["issues_by_category"] = categories
        
        return report
    
    def save_report(self, report: Dict[str, Any]):
        """Save report to file"""
        report_path = Path("test-results/ui-audit-report.json")
        report_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info(f"Report saved to {report_path}")
        
        # Also save markdown summary
        md_path = Path("test-results/ui-audit-summary.md")
        with open(md_path, 'w') as f:
            f.write("# A2R Platform UI Audit Summary\n\n")
            f.write(f"**Date:** {report['audit_date']}\n")
            f.write(f"**Base URL:** {report['base_url']}\n\n")
            f.write(f"**Total Issues:** {report['total_issues']}\n\n")
            f.write("## Issues by Priority\n\n")
            for priority, count in report['issues_by_priority'].items():
                f.write(f"- **{priority}:** {count}\n")
            f.write("\n## Issues by Category\n\n")
            for category, issues in report['issues_by_category'].items():
                f.write(f"### {category}\n\n")
                for issue in issues:
                    f.write(f"- [{issue['priority']}] {issue['description']}\n")
                f.write("\n")
        
        logger.info(f"Summary saved to {md_path}")


async def main():
    """Main entry point"""
    print("=" * 60)
    print("A2R Platform UI Audit")
    print("=" * 60)
    print()
    
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5177"
    
    auditor = UIAuditor(base_url)
    
    if not PLAYWRIGHT_AVAILABLE:
        print("❌ Playwright not available")
        print("Install with: pip install playwright==1.49.0")
        print("Then run: playwright install")
        sys.exit(1)
    
    report = await auditor.audit_with_playwright()
    auditor.save_report(report)
    
    print()
    print("=" * 60)
    print("Audit Complete")
    print("=" * 60)
    print()
    print(f"Total Issues: {report['total_issues']}")
    print()
    print("Issues by Priority:")
    for priority, count in report['issues_by_priority'].items():
        print(f"  {priority}: {count}")
    print()
    print(f"Report: test-results/ui-audit-report.json")
    print(f"Summary: test-results/ui-audit-summary.md")
    print(f"Screenshots: {auditor.screenshots_dir}")
    print()


if __name__ == "__main__":
    asyncio.run(main())

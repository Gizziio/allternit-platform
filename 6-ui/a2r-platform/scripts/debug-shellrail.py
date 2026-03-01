#!/usr/bin/env python3
"""
A2R ShellRail Debug - Iterative Fix Script
Uses Playwright to inspect and fix the ShellRail rendering issues
"""

import asyncio
import sys
from playwright.async_api import async_playwright

async def debug_shellrail():
    """Debug the ShellRail rendering issues"""
    
    print("=" * 60)
    print("A2R ShellRail Debug - Starting Browser Automation")
    print("=" * 60)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)  # Headless=False so we can see
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080}
        )
        page = await context.new_page()
        
        # Enable console logging
        page.on("console", lambda msg: print(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: print(f"[PAGE ERROR] {err}"))
        
        try:
            # Navigate to app
            print("\n📍 Navigating to http://127.0.0.1:5177...")
            await page.goto("http://127.0.0.1:5177", wait_until="networkidle")
            await page.wait_for_timeout(5000)  # Wait for full load
            
            # Take screenshot
            await page.screenshot(path="/tmp/shellrail-debug-1.png")
            print("📸 Screenshot saved to /tmp/shellrail-debug-1.png")
            
            # Check if ShellRail exists
            print("\n🔍 Checking ShellRail structure...")
            rail_exists = await page.query_selector('[class*="ShellRail"]') is not None
            print(f"ShellRail component exists: {rail_exists}")
            
            # Check for GlassSurface
            glass_exists = await page.query_selector('[class*="GlassSurface"]') is not None
            print(f"GlassSurface exists: {glass_exists}")
            
            # Count rail items
            rail_items = await page.query_selector_all('button[class*="flex-1 flex items-center gap"]')
            print(f"Rail items found: {len(rail_items)}")
            
            # Check for Core section
            core_section = await page.query_selector('text=CORE')
            print(f"Core section visible: {core_section is not None}")
            
            # Check for Home item
            home_item = await page.query_selector('text=Home')
            print(f"Home item visible: {home_item is not None}")
            
            # Get computed styles of the main rail container
            print("\n📐 Checking computed styles...")
            rail_styles = await page.evaluate("""() => {
                const rail = document.querySelector('[class*="ShellRail"]');
                if (!rail) return null;
                const styles = window.getComputedStyle(rail);
                return {
                    height: styles.height,
                    width: styles.width,
                    overflow: styles.overflow,
                    display: styles.display,
                    position: styles.position
                };
            }""")
            print(f"Rail styles: {rail_styles}")
            
            # Check parent container overflow
            parent_overflow = await page.evaluate("""() => {
                const glass = document.querySelector('[class*="GlassSurface"]');
                if (!glass) return null;
                const parent = glass.parentElement;
                const styles = window.getComputedStyle(parent);
                return styles.overflow;
            }""")
            print(f"Parent overflow: {parent_overflow}")
            
            # Try to click Home item if it exists
            if home_item:
                print("\n✅ Home item found - attempting to click...")
                await home_item.click()
                await page.wait_for_timeout(1000)
                print("Home item clicked successfully")
            else:
                print("\n❌ Home item NOT found - this is the bug!")
                
                # Try to find what IS rendering
                all_buttons = await page.query_selector_all('button')
                print(f"Total buttons on page: {len(all_buttons)}")
                
                # Check if items are in DOM but not visible
                items_in_dom = await page.evaluate("""() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    return buttons.filter(b => {
                        const text = b.textContent?.trim();
                        return text && ['Home', 'New Chat', 'Browser', 'Elements'].some(t => text.includes(t));
                    }).map(b => ({
                        text: b.textContent?.trim(),
                        visible: b.offsetParent !== null,
                        rect: b.getBoundingClientRect()
                    }));
                }""")
                print(f"Items in DOM: {items_in_dom}")
            
            print("\n" + "=" * 60)
            print("Debug Complete - Check screenshots and console output")
            print("=" * 60)
            
        except Exception as e:
            print(f"\n❌ Error during debug: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(debug_shellrail())

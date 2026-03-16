#!/usr/bin/env python3
# Verify Canvas Modules using Playwright

from playwright.sync_api import sync_playwright
import os

def verify_canvas_modules():
    canvas_url = "https://canvas.instructure.com/courses/14389375/modules"
    screenshot_path = "/Users/macbook/Desktop/canvas_verification.png"
    
    print("=== Canvas Module Verification via Playwright ===")
    print(f"Navigating to: {canvas_url}")
    print("")
    
    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Navigate to Canvas modules page
        print("Loading page...")
        page.goto(canvas_url, wait_until="networkidle")
        
        # Take screenshot
        print("Taking screenshot...")
        page.screenshot(path=screenshot_path, full_page=True)
        
        # Extract module names
        print("Extracting module names...")
        modules = page.query_selector_all('[data-module-name], .module, [class*="module"]')
        
        module_names = []
        for module in modules[:20]:  # Limit to first 20
            name_el = module.query_selector('[data-module-name]')
            if name_el:
                name = name_el.inner_text().strip()
                if name and name not in module_names:
                    module_names.append(name)
        
        # Also try alternative selectors
        if not module_names:
            elements = page.query_selector_all('h3, .name, [title]')
            for el in elements[:50]:
                text = el.inner_text().strip()
                if text and ('module' in text.lower() or 'week' in text.lower()):
                    if text not in module_names:
                        module_names.append(text)
        
        browser.close()
        
        print("")
        print("=== VERIFICATION RESULT ===")
        print("")
        print(f"Screenshot saved to: {screenshot_path}")
        print("")
        print(f"Modules found on page ({len(module_names)}):")
        for i, name in enumerate(module_names, 1):
            found = "✅" if "week 1" in name.lower() or "ai" in name.lower() else "  "
            print(f"  {found} {i}. {name}")
        
        # Check for our specific module
        week1_found = any("week 1" in name.lower() and "ai" in name.lower() for name in module_names)
        print("")
        if week1_found:
            print("✅ 'week 1 ai basics' module FOUND in Canvas!")
        else:
            print("❌ 'week 1 ai basics' module NOT found in Canvas")
            print("")
            print("Note: The API reported creating modules, but they may not be visible")
            print("due to Canvas caching, permissions, or the modules were created in a different state.")

if __name__ == "__main__":
    try:
        verify_canvas_modules()
    except Exception as e:
        print(f"ERROR: {e}")
        import sys
        sys.exit(1)

#!/usr/bin/env python3
"""
E2E Test for BYOC "Enter Backend URL" Flow using Playwright
Tests the onboarding flow with manual backend registration.
"""

import asyncio
from playwright.async_api import async_playwright

# Test configuration
PLATFORM_URL = "https://platform.allternit.com"
TEST_BACKEND_URL = "https://httpbin.org"
TEST_BACKEND_NAME = "E2E Test Backend"

async def test_byoc_flow():
    """Test the BYOC manual backend URL flow through onboarding"""
    
    print("=" * 70)
    print("BYOC 'Enter Backend URL' E2E Test (Playwright)")
    print("=" * 70)
    print(f"Platform URL: {PLATFORM_URL}")
    print("=" * 70)
    
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(viewport={'width': 1400, 'height': 900})
        page = await context.new_page()
        
        # Capture console logs
        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        
        try:
            # Test 1: Navigate to platform landing page
            print("\n[TEST 1] Navigate to platform landing page...")
            await page.goto(PLATFORM_URL, wait_until="networkidle", timeout=60000)
            await page.wait_for_timeout(3000)
            
            title = await page.title()
            print(f"  Page Title: {title}")
            
            await page.screenshot(path="/Users/macbook/Desktop/test-1-landing.png")
            print("  Screenshot saved: test-1-landing.png")
            
            # Test 2: Click "Get Started" to begin onboarding
            print("\n[TEST 2] Click 'Get Started' to begin onboarding...")
            
            get_started_selectors = [
                'button:has-text("Get Started")',
                'a:has-text("Get Started")',
                'text=Get Started'
            ]
            
            clicked = False
            for selector in get_started_selectors:
                try:
                    await page.locator(selector).first.click(timeout=5000)
                    print(f"  Clicked: {selector}")
                    clicked = True
                    break
                except:
                    continue
            
            if not clicked:
                print("  'Get Started' button not found - may already be in app")
            
            await page.wait_for_timeout(5000)
            await page.screenshot(path="/Users/macbook/Desktop/test-2-after-getstarted.png")
            print("  Screenshot saved: test-2-after-getstarted.png")
            
            current_url = page.url
            print(f"  Current URL: {current_url}")
            
            # Test 3: Look for Infrastructure step in onboarding
            print("\n[TEST 3] Look for Infrastructure step...")
            
            # Check if we're on sign-in page
            if "sign-in" in current_url or "sign-up" in current_url:
                print("  On sign-in page - need to sign in first")
                print("  Looking for 'Create an account' link...")
                
                signup_links = [
                    'text=Create an account',
                    'text=Sign up',
                    'a:has-text("Create an account")'
                ]
                
                for selector in signup_links:
                    try:
                        await page.locator(selector).first.click(timeout=3000)
                        print(f"  Clicked: {selector}")
                        await page.wait_for_timeout(3000)
                        break
                    except:
                        pass
                
                await page.screenshot(path="/Users/macbook/Desktop/test-3-signup.png")
                print("  Screenshot saved: test-3-signup.png")
                
                print("  NOTE: Cannot proceed without authentication")
                print("  The BYOC feature requires sign-in to test")
                
            else:
                # Look for infrastructure options
                print("  Looking for infrastructure options...")
                
                infra_selectors = [
                    'text=Use this computer',
                    'text=Enter backend URL',
                    'text=I have a server',
                    'h3:has-text("Infrastructure")',
                    'h2:has-text("Infrastructure")',
                    'h4:has-text("Where should")'
                ]
                
                for selector in infra_selectors:
                    try:
                        if await page.locator(selector).first.is_visible(timeout=2000):
                            print(f"  Found: {selector}")
                    except:
                        pass
                
                await page.screenshot(path="/Users/macbook/Desktop/test-3-infrastructure.png")
                print("  Screenshot saved: test-3-infrastructure.png")
            
            # Test 4: Look for "Enter backend URL" option specifically
            print("\n[TEST 4] Look for 'Enter backend URL' option...")
            
            backend_option_selectors = [
                'text=Enter backend URL',
                'button:has-text("Enter backend URL")',
                '[data-testid="manual-backend-option"]',
                'h3:has-text("Enter backend URL")',
                'h4:has-text("Enter backend URL")',
                'p:has-text("Enter backend URL")',
                'label:has-text("Enter backend URL")'
            ]
            
            backend_option_found = False
            for selector in backend_option_selectors:
                try:
                    element = page.locator(selector).first
                    if await element.is_visible(timeout=3000):
                        print(f"  FOUND 'Enter backend URL' option: {selector}")
                        await element.click()
                        backend_option_found = True
                        break
                except Exception as e:
                    continue
            
            if not backend_option_found:
                print("  'Enter backend URL' option NOT found")
                print("  This could mean:")
                print("    - Not on the infrastructure step yet")
                print("    - Option has different text/selector")
                print("    - Authentication required first")
            
            await page.wait_for_timeout(2000)
            await page.screenshot(path="/Users/macbook/Desktop/test-4-backend-option.png")
            print("  Screenshot saved: test-4-backend-option.png")
            
            # Test 5: Fill in the form (if found)
            print("\n[TEST 5] Fill in backend URL form...")
            
            if backend_option_found:
                # Look for form fields
                name_selectors = ['input[name="name"]', 'input[placeholder*="name" i]', '#name', '[data-testid="backend-name"]', 'input[type="text"]']
                url_selectors = ['input[name="gatewayUrl"]', 'input[placeholder*="URL" i]', '#gatewayUrl', 'input[type="url"]', 'input[placeholder*="http" i]']
                
                name_filled = False
                url_filled = False
                
                for selector in name_selectors:
                    try:
                        await page.locator(selector).first.fill(TEST_BACKEND_NAME, timeout=2000)
                        print(f"  Filled name field: {selector}")
                        name_filled = True
                        break
                    except:
                        pass
                
                for selector in url_selectors:
                    try:
                        await page.locator(selector).first.fill(TEST_BACKEND_URL, timeout=2000)
                        print(f"  Filled URL field: {selector}")
                        url_filled = True
                        break
                    except:
                        pass
                
                if name_filled and url_filled:
                    print("  Form filled successfully")
                    await page.screenshot(path="/Users/macbook/Desktop/test-5-form-filled.png")
                    print("  Screenshot saved: test-5-form-filled.png")
                    
                    # Test 6: Submit the form
                    print("\n[TEST 6] Submit form...")
                    
                    submit_selectors = [
                        'button:has-text("Connect")',
                        'button:has-text("Submit")',
                        'button[type="submit"]',
                        '[data-testid="connect-button"]',
                        'button:has-text("Save")'
                    ]
                    
                    for selector in submit_selectors:
                        try:
                            await page.locator(selector).first.click(timeout=2000)
                            print(f"  Clicked submit: {selector}")
                            break
                        except:
                            pass
                    
                    await page.wait_for_timeout(3000)
                    await page.screenshot(path="/Users/macbook/Desktop/test-6-submitted.png")
                    print("  Screenshot saved: test-6-submitted.png")
                    
                else:
                    print("  Could not fill form - fields not found")
            else:
                print("  Skipping form fill - backend option not found")
            
            # Print console logs (errors only)
            print("\n[CONSOLE ERRORS]")
            error_logs = [log for log in console_logs if log.startswith("[error]")]
            if error_logs:
                for log in error_logs[-10:]:  # Last 10 errors
                    print(f"  {log}")
            else:
                print("  No errors logged")
            
            print("\n" + "=" * 70)
            print("E2E Test Complete")
            print("Screenshots saved to Desktop")
            print("=" * 70)
            
        except Exception as e:
            print(f"\n[ERROR] {e}")
            import traceback
            traceback.print_exc()
            await page.screenshot(path="/Users/macbook/Desktop/test-error.png")
            print("  Error screenshot saved: test-error.png")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(test_byoc_flow())

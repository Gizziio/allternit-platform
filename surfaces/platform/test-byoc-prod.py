#!/usr/bin/env python3
"""
E2E Test for BYOC "Enter Backend URL" Flow - PRODUCTION TEST
Uses the actual Cloudflare backend and verifies full message flow.
"""

import asyncio
from playwright.async_api import async_playwright

# PRODUCTION backend configuration
PLATFORM_URL = "https://platform.allternit.com"
BACKEND_URL = "https://mainly-earn-considers-fossil.trycloudflare.com"
TEST_BACKEND_NAME = "Cloudflare Production Backend"

async def test_byoc_production():
    """Test BYOC with actual production backend"""
    
    print("=" * 70)
    print("BYOC PRODUCTION E2E Test")
    print("=" * 70)
    print(f"Platform: {PLATFORM_URL}")
    print(f"Backend: {BACKEND_URL}")
    print("=" * 70)
    
    # First, verify backend health
    print("\n[PRE-FLIGHT] Checking backend health...")
    import urllib.request
    import ssl
    
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    
    try:
        health_url = f"{BACKEND_URL}/v1/global/health"
        req = urllib.request.Request(health_url, method='GET')
        req.add_header('Accept', 'application/json')
        
        with urllib.request.urlopen(req, context=ssl_context, timeout=30) as response:
            status = response.status
            body = response.read().decode('utf-8')
            print(f"  Health check status: {status}")
            print(f"  Response: {body[:200]}")
            
            if status == 200:
                print("  ✅ Backend is healthy!")
            else:
                print(f"  ⚠️ Backend returned status {status}")
    except Exception as e:
        print(f"  ❌ Backend health check failed: {e}")
        print("  The Cloudflare tunnel may be down or the backend not running.")
        return
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(viewport={'width': 1400, 'height': 900})
        page = await context.new_page()
        
        # Capture ALL console logs
        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        
        try:
            # Step 1: Navigate to platform
            print("\n[STEP 1] Navigate to platform...")
            await page.goto(PLATFORM_URL, wait_until="networkidle", timeout=60000)
            await page.wait_for_timeout(3000)
            print(f"  Page: {await page.title()}")
            await page.screenshot(path="/Users/macbook/Desktop/prod-1-landing.png")
            
            # Step 2: Click Get Started
            print("\n[STEP 2] Start onboarding...")
            await page.locator('button:has-text("Get Started")').first.click(timeout=10000)
            await page.wait_for_timeout(5000)
            await page.screenshot(path="/Users/macbook/Desktop/prod-2-onboarding.png")
            
            current_url = page.url
            print(f"  URL: {current_url}")
            
            # Step 3: Select "Enter backend URL"
            print("\n[STEP 3] Select 'Enter backend URL'...")
            await page.locator('text=Enter backend URL').first.click(timeout=10000)
            await page.wait_for_timeout(2000)
            print("  ✅ Selected 'Enter backend URL'")
            await page.screenshot(path="/Users/macbook/Desktop/prod-3-selected.png")
            
            # Step 4: Fill form with PRODUCTION backend
            print("\n[STEP 4] Fill production backend details...")
            
            # Find and fill all fields
            inputs = await page.locator('input').all()
            print(f"  Found {len(inputs)} input fields")
            
            # Fill URL field (should be first)
            url_filled = False
            name_filled = False
            
            for i, input_el in enumerate(inputs):
                try:
                    placeholder = await input_el.get_attribute('placeholder') or ''
                    input_type = await input_el.get_attribute('type') or 'text'
                    print(f"    Input {i}: type={input_type}, placeholder={placeholder[:30] if placeholder else 'none'}...")
                    
                    if not url_filled and ('url' in placeholder.lower() or input_type == 'url' or 'http' in placeholder.lower()):
                        await input_el.fill(BACKEND_URL)
                        print(f"    → Filled with BACKEND_URL")
                        url_filled = True
                    elif not name_filled and ('name' in placeholder.lower() or placeholder == ''):
                        await input_el.fill(TEST_BACKEND_NAME)
                        print(f"    → Filled with BACKEND_NAME")
                        name_filled = True
                except Exception as e:
                    print(f"    Error with input {i}: {e}")
            
            await page.wait_for_timeout(1000)
            await page.screenshot(path="/Users/macbook/Desktop/prod-4-filled.png")
            
            # Step 5: Click Connect
            print("\n[STEP 5] Connect to production backend...")
            
            # Clear previous logs
            console_logs.clear()
            
            connect_button = page.locator('button:has-text("Connect")').first
            await connect_button.click(timeout=10000)
            print("  Clicked 'Connect' - waiting for response...")
            
            # Wait for API response
            await page.wait_for_timeout(8000)
            await page.screenshot(path="/Users/macbook/Desktop/prod-5-connected.png")
            
            # Check console for API response
            print("\n[STEP 6] Analyze connection result...")
            
            api_logs = [log for log in console_logs if 'api' in log.lower() or 'backend' in log.lower() or 'connect' in log.lower()]
            error_logs = [log for log in console_logs if log.startswith('[error]')]
            
            print(f"  API-related logs: {len(api_logs)}")
            for log in api_logs[-5:]:
                print(f"    {log}")
            
            print(f"  Error logs: {len(error_logs)}")
            for log in error_logs[-5:]:
                print(f"    {log}")
            
            # Look for success indicators
            success_indicators = ['success', 'connected', '200', 'healthy']
            found_success = any(ind in ' '.join(console_logs).lower() for ind in success_indicators)
            
            if found_success:
                print("  ✅ Connection appears successful!")
            else:
                print("  ⚠️ No clear success indicator found")
            
            # Step 7: Continue onboarding and test chat
            print("\n[STEP 7] Complete onboarding and test chat...")
            
            # Click Continue to proceed
            continue_buttons = await page.locator('button:has-text("Continue")').all()
            if continue_buttons:
                for btn in continue_buttons:
                    try:
                        if await btn.is_visible() and await btn.is_enabled():
                            await btn.click()
                            print("  Clicked Continue")
                            await page.wait_for_timeout(3000)
                            break
                    except:
                        pass
            
            await page.screenshot(path="/Users/macbook/Desktop/prod-7-post-connect.png")
            
            # Check if we can access the shell/chat
            print("\n[STEP 8] Navigate to shell to test messaging...")
            await page.goto(f"{PLATFORM_URL}/shell", wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(5000)
            await page.screenshot(path="/Users/macbook/Desktop/prod-8-shell.png")
            
            current_url = page.url
            print(f"  Shell URL: {current_url}")
            
            # Look for chat input
            chat_inputs = await page.locator('textarea, input[type="text"]').all()
            print(f"  Found {len(chat_inputs)} text inputs")
            
            for inp in chat_inputs:
                try:
                    placeholder = await inp.get_attribute('placeholder') or ''
                    if 'message' in placeholder.lower() or 'ask' in placeholder.lower() or 'chat' in placeholder.lower():
                        print(f"  Found chat input: {placeholder}")
                        
                        # Clear logs and send a test message
                        console_logs.clear()
                        
                        await inp.fill("Hello, this is an E2E test message. Please respond with 'Test received.'")
                        await inp.press('Enter')
                        print("  Sent test message - waiting for response...")
                        
                        # Wait for response
                        await page.wait_for_timeout(15000)
                        await page.screenshot(path="/Users/macbook/Desktop/prod-9-response.png")
                        
                        # Check for response
                        response_logs = [log for log in console_logs if 'message' in log.lower() or 'response' in log.lower() or 'stream' in log.lower()]
                        print(f"  Response-related logs: {len(response_logs)}")
                        for log in response_logs[-5:]:
                            print(f"    {log[:150]}")
                        
                        break
                except:
                    pass
            
            # Final screenshot
            await page.screenshot(path="/Users/macbook/Desktop/prod-final.png")
            
            print("\n" + "=" * 70)
            print("PRODUCTION E2E Test Complete")
            print("=" * 70)
            print("\nScreenshots:")
            print("  - prod-1-landing.png - Landing page")
            print("  - prod-2-onboarding.png - Onboarding started")
            print("  - prod-3-selected.png - Backend option selected")
            print("  - prod-4-filled.png - Form filled with production backend")
            print("  - prod-5-connected.png - After clicking Connect")
            print("  - prod-7-post-connect.png - Post-connection state")
            print("  - prod-8-shell.png - Shell view")
            print("  - prod-9-response.png - After sending test message")
            print("  - prod-final.png - Final state")
            
        except Exception as e:
            print(f"\n[ERROR] {e}")
            import traceback
            traceback.print_exc()
            await page.screenshot(path="/Users/macbook/Desktop/prod-error.png")
        finally:
            print("\n[FINAL] All console logs:")
            for log in console_logs[-20:]:
                print(f"  {log}")
            await browser.close()

if __name__ == "__main__":
    asyncio.run(test_byoc_production())

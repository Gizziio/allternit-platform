#!/usr/bin/env python3
"""
E2E Test for BYOC "Enter Backend URL" Flow - LOCAL TEST
Tests with actual working backend and verifies full message flow.
"""

import asyncio
from playwright.async_api import async_playwright

# LOCAL testing configuration
PLATFORM_URL = "http://localhost:3013"
BACKEND_URL = "https://mainly-earn-considers-fossil.trycloudflare.com"
TEST_BACKEND_NAME = "Cloudflare Backend"

async def test_byoc_local():
    """Test BYOC with actual production backend locally"""
    
    print("=" * 70)
    print("BYOC LOCAL E2E Test with REAL Backend")
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
            print(f"  Response: {body}")
            
            if status == 200:
                print("  ✅ Backend is healthy!")
            else:
                print(f"  ⚠️ Backend returned status {status}")
                return
    except Exception as e:
        print(f"  ❌ Backend health check failed: {e}")
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
            print("\n[STEP 1] Navigate to local platform...")
            await page.goto(PLATFORM_URL, wait_until="networkidle", timeout=60000)
            await page.wait_for_timeout(3000)
            print(f"  Page: {await page.title()}")
            await page.screenshot(path="/Users/macbook/Desktop/local-1-landing.png")
            
            # Step 2: Click Get Started
            print("\n[STEP 2] Start onboarding...")
            await page.locator('button:has-text("Get Started")').first.click(timeout=10000)
            await page.wait_for_timeout(5000)
            await page.screenshot(path="/Users/macbook/Desktop/local-2-onboarding.png")
            
            current_url = page.url
            print(f"  URL: {current_url}")
            
            # Step 3: Select "Enter backend URL"
            print("\n[STEP 3] Select 'Enter backend URL'...")
            await page.locator('text=Enter backend URL').first.click(timeout=10000)
            await page.wait_for_timeout(2000)
            print("  ✅ Selected 'Enter backend URL'")
            await page.screenshot(path="/Users/macbook/Desktop/local-3-selected.png")
            
            # Step 4: Fill form with PRODUCTION backend
            print("\n[STEP 4] Fill production backend details...")
            
            # Find and fill URL field
            url_input = page.locator('input[placeholder*="URL" i]').first
            await url_input.fill(BACKEND_URL)
            print(f"  Filled URL: {BACKEND_URL}")
            
            # Find and fill name field
            name_input = page.locator('input[placeholder*="name" i]').first
            await name_input.fill(TEST_BACKEND_NAME)
            print(f"  Filled Name: {TEST_BACKEND_NAME}")
            
            await page.wait_for_timeout(1000)
            await page.screenshot(path="/Users/macbook/Desktop/local-4-filled.png")
            
            # Step 5: Click Connect and monitor API response
            print("\n[STEP 5] Connect to production backend...")
            print("  Clicking 'Connect to Backend'...")
            
            # Clear previous logs
            console_logs.clear()
            
            connect_button = page.locator('button:has-text("Connect")').first
            await connect_button.click(timeout=10000)
            
            # Wait for API response
            print("  Waiting for API response (up to 15s)...")
            await page.wait_for_timeout(15000)
            await page.screenshot(path="/Users/macbook/Desktop/local-5-connected.png")
            
            # Step 6: Analyze connection result
            print("\n[STEP 6] Analyze connection result...")
            
            # Look for specific API logs
            allternit_logs = [log for log in console_logs if 'allternit' in log.lower()]
            api_logs = [log for log in console_logs if 'api' in log.lower() or 'backend' in log.lower()]
            error_logs = [log for log in console_logs if log.startswith('[error]')]
            
            print(f"  Allternit logs: {len(allternit_logs)}")
            for log in allternit_logs[-5:]:
                print(f"    {log}")
            
            print(f"  API-related logs: {len(api_logs)}")
            for log in api_logs[-5:]:
                print(f"    {log}")
            
            print(f"  Error logs: {len(error_logs)}")
            for log in error_logs[-5:]:
                print(f"    {log}")
            
            # Check if connection was successful
            success_keywords = ['success', 'connected', 'healthy', '200']
            has_success = any(kw in ' '.join(console_logs).lower() for kw in success_keywords)
            
            if has_success:
                print("  ✅ Connection appears successful!")
            else:
                print("  ⚠️ No clear success indicator - checking page state...")
            
            # Step 7: Check if we can continue onboarding
            print("\n[STEP 7] Check if we can continue...")
            
            # Look for continue button
            continue_btn = page.locator('button:has-text("Continue")')
            if await continue_btn.count() > 0:
                is_enabled = await continue_btn.first.is_enabled()
                print(f"  Continue button enabled: {is_enabled}")
                
                if is_enabled:
                    await continue_btn.first.click()
                    print("  Clicked Continue")
                    await page.wait_for_timeout(3000)
            
            await page.screenshot(path="/Users/macbook/Desktop/local-7-continued.png")
            
            # Step 8: Navigate to shell and test chat
            print("\n[STEP 8] Navigate to shell and test chat...")
            await page.goto(f"{PLATFORM_URL}/shell", wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(5000)
            
            current_url = page.url
            print(f"  Shell URL: {current_url}")
            await page.screenshot(path="/Users/macbook/Desktop/local-8-shell.png")
            
            # Check if backend is connected
            page_content = await page.content()
            if "connected" in page_content.lower() or "backend" in page_content.lower():
                print("  Backend connection indicator found on page")
            
            # Look for chat input
            print("\n[STEP 9] Look for chat input...")
            
            # Try multiple selectors for chat input
            chat_selectors = [
                'textarea[placeholder*="message" i]',
                'textarea[placeholder*="ask" i]',
                'input[placeholder*="message" i]',
                '[data-testid="chat-input"]',
                'textarea'
            ]
            
            chat_input = None
            for selector in chat_selectors:
                try:
                    el = page.locator(selector).first
                    if await el.is_visible(timeout=2000):
                        chat_input = el
                        print(f"  Found chat input: {selector}")
                        break
                except:
                    pass
            
            if chat_input:
                # Clear logs before sending message
                console_logs.clear()
                
                # Send test message
                test_message = "Hello! This is an E2E test. Please respond with 'Test successful: Backend connected.'"
                await chat_input.fill(test_message)
                print(f"  Filled message: {test_message[:50]}...")
                
                # Press Enter to send
                await chat_input.press('Enter')
                print("  Sent message - waiting for response (30s)...")
                
                # Wait for response
                await page.wait_for_timeout(30000)
                await page.screenshot(path="/Users/macbook/Desktop/local-9-response.png")
                
                # Check for response indicators
                response_logs = [log for log in console_logs if any(kw in log.lower() for kw in ['response', 'message', 'stream', 'chunk', 'assistant'])]
                print(f"\n  Response-related logs ({len(response_logs)}):")
                for log in response_logs[-10:]:
                    print(f"    {log[:150]}")
                
                # Check page content for assistant response
                page_text = await page.inner_text('body')
                if "test successful" in page_text.lower() or "backend connected" in page_text.lower():
                    print("\n  ✅ FOUND RESPONSE: Backend connected and model responded!")
                elif await page.locator('text=Test successful').count() > 0:
                    print("\n  ✅ FOUND RESPONSE: Test successful message detected!")
                else:
                    print("\n  ⚠️ Response not clearly detected - check screenshot")
            else:
                print("  Chat input not found - may need authentication or different UI state")
            
            # Final screenshot
            await page.screenshot(path="/Users/macbook/Desktop/local-final.png")
            
            print("\n" + "=" * 70)
            print("LOCAL E2E Test Complete")
            print("=" * 70)
            print("\nScreenshots:")
            print("  - local-1-landing.png - Landing page")
            print("  - local-2-onboarding.png - Onboarding started")
            print("  - local-3-selected.png - Backend option selected")
            print("  - local-4-filled.png - Form filled with production backend")
            print("  - local-5-connected.png - After clicking Connect")
            print("  - local-7-continued.png - After continuing")
            print("  - local-8-shell.png - Shell view")
            print("  - local-9-response.png - After sending test message")
            print("  - local-final.png - Final state")
            
        except Exception as e:
            print(f"\n[ERROR] {e}")
            import traceback
            traceback.print_exc()
            await page.screenshot(path="/Users/macbook/Desktop/local-error.png")
        finally:
            print("\n[FINAL] Last 20 console logs:")
            for log in console_logs[-20:]:
                print(f"  {log}")
            await browser.close()

if __name__ == "__main__":
    asyncio.run(test_byoc_local())

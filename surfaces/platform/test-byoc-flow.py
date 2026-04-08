#!/usr/bin/env python3
"""
E2E Test for BYOC "Enter Backend URL" Flow
Tests the manual backend registration feature end-to-end.
"""

import asyncio
import sys
import os

# Add browser-use to path
sys.path.insert(0, '/Users/macbook/browser-use')

from browser_use import Agent, Browser, BrowserConfig, Controller
from langchain_ollama import ChatOllama

# Test configuration
PLATFORM_URL = "https://platform-f26gmjcc9-gizzi-io-6138s-projects.vercel.app"
# Use httpbin as a test endpoint that will return 200 for health checks
TEST_BACKEND_URL = "https://httpbin.org"  
TEST_BACKEND_NAME = "E2E Test Backend"

async def test_byoc_flow():
    """Test the BYOC manual backend URL flow"""
    
    print("=" * 70)
    print("BYOC 'Enter Backend URL' E2E Test")
    print("=" * 70)
    print(f"Platform URL: {PLATFORM_URL}")
    print(f"Test Backend URL: {TEST_BACKEND_URL}")
    print("=" * 70)
    
    # Initialize browser
    browser = Browser(config=BrowserConfig(
        headless=False,  # Set to True for headless mode
        disable_security=True,
    ))
    
    # Initialize LLM
    llm = ChatOllama(
        model="qwen2.5-coder",
        base_url="http://127.0.0.1:11434",
        temperature=0.1,
    )
    
    controller = Controller()
    
    try:
        # Test 1: Navigate to platform and verify it loads
        print("\n[TEST 1] Navigate to platform and verify loading...")
        agent = Agent(
            task=f"""
Navigate to {PLATFORM_URL} and wait for the page to fully load.
Take a screenshot and report:
1. What is the page title?
2. What main elements do you see?
3. Is there a sign-in button or is the user already signed in?
4. Look for any error messages or loading states

Wait up to 30 seconds for the page to load completely.
""",
            llm=llm,
            browser=browser,
            controller=controller,
        )
        result = await agent.run()
        print(f"Result: {result}")
        
        # Test 2: Navigate to infrastructure settings
        print("\n[TEST 2] Navigate to infrastructure settings...")
        agent2 = Agent(
            task=f"""
Navigate to {PLATFORM_URL}/shell/settings/infrastructure (or look for Settings > Infrastructure in the UI).

If you see a sign-in page, stop and report that authentication is required.

If you're in the app:
1. Look for Settings menu (gear icon or similar)
2. Navigate to Infrastructure section
3. Take a screenshot of the infrastructure options
4. Report what options are available (Use this computer, Enter backend URL, etc.)

Wait for elements to appear before interacting.
""",
            llm=llm,
            browser=browser,
            controller=controller,
        )
        result2 = await agent2.run()
        print(f"Result: {result2}")
        
        # Test 3: Click "Enter backend URL" option
        print("\n[TEST 3] Click 'Enter backend URL' option...")
        agent3 = Agent(
            task=f"""
Look for and click on an option labeled "Enter backend URL" or similar (with a Globe icon).

After clicking:
1. Take a screenshot of the form that appears
2. Report what form fields are visible (name, URL, auth token, etc.)
3. Check if there's a "Connect" or "Submit" button

If you don't see this option, report what infrastructure options ARE available.
""",
            llm=llm,
            browser=browser,
            controller=controller,
        )
        result3 = await agent3.run()
        print(f"Result: {result3}")
        
        # Test 4: Fill in the backend URL form
        print("\n[TEST 4] Fill in the backend URL form...")
        agent4 = Agent(
            task=f"""
Fill in the "Enter Backend URL" form with:
- Name: "{TEST_BACKEND_NAME}"
- Gateway URL: "{TEST_BACKEND_URL}"
- Auth Token: (leave empty or enter "test-token" if required)

Do NOT click Connect yet - just fill in the form and take a screenshot.
Report:
1. Were you able to fill in all fields?
2. Any validation errors appeared?
3. What does the form look like when filled?
""",
            llm=llm,
            browser=browser,
            controller=controller,
        )
        result4 = await agent4.run()
        print(f"Result: {result4}")
        
        # Test 5: Submit the form and check response
        print("\n[TEST 5] Submit the form and capture response...")
        agent5 = Agent(
            task=f"""
Click the "Connect" or "Submit" button on the backend URL form.

Wait for the response and report:
1. What happens after clicking? (loading state, success message, error, etc.)
2. Take a screenshot of the result
3. Check browser console for any network errors or API responses
4. If there's an error, what does it say?

The backend might not actually connect (since we're using httpbin), but we want to see:
- Is the API call being made correctly?
- What error handling is in place?
""",
            llm=llm,
            browser=browser,
            controller=controller,
        )
        result5 = await agent5.run()
        print(f"Result: {result5}")
        
        # Test 6: Check console logs for any errors
        print("\n[TEST 6] Check browser console logs...")
        agent6 = Agent(
            task=f"""
Open the browser developer console (F12) and check for:
1. Any red error messages
2. Network requests to /api/v1/runtime/backend/manual
3. Response status and body from the API call

Take a screenshot of the console and report any errors or the API response.
""",
            llm=llm,
            browser=browser,
            controller=controller,
        )
        result6 = await agent6.run()
        print(f"Result: {result6}")
        
        print("\n" + "=" * 70)
        print("E2E Test Complete")
        print("=" * 70)
        
    except Exception as e:
        print(f"\n[ERROR] Test failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Keep browser open for a moment to see final state
        await asyncio.sleep(5)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_byoc_flow())

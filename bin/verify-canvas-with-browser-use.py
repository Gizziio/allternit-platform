#!/usr/bin/env python3
# Verify Canvas Modules using Browser-Use Agent

import asyncio
import sys
import os
from browser_use import Agent
from langchain_openai import ChatOpenAI

async def verify_canvas_modules():
    canvas_url = "https://canvas.instructure.com/courses/14389375/modules"
    screenshot_path = "/Users/macbook/Desktop/canvas_verification.png"
    
    # Configure LLM
    llm = ChatOpenAI(
        model="qwen2.5-coder:latest",
        base_url="http://127.0.0.1:11434/v1",
        api_key="ollama"
    )
    
    task = f"""Navigate to {canvas_url}

1. Wait for the page to fully load
2. Look for any modules on the page
3. Find modules with names containing "Week 1" or "AI" or "week 1"
4. Take a screenshot and save it to {screenshot_path}
5. List all module names you can see on the page
6. Tell me if you see any modules named "week 1 ai basics"

Return:
- Screenshot saved: yes/no
- Module names found: [list]
- "week 1 ai basics" found: yes/no
"""
    
    print("=== Canvas Module Verification via Browser-Use ===")
    print(f"Navigating to: {canvas_url}")
    print("")
    
    agent = Agent(
        task=task,
        llm=llm,
    )
    
    try:
        result = await agent.run()
        print("\n=== VERIFICATION RESULT ===")
        print(result)
        
        if os.path.exists(screenshot_path):
            print(f"\n✅ Screenshot saved to: {screenshot_path}")
        else:
            print("\n⚠️ Screenshot not found")
            
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(verify_canvas_modules())

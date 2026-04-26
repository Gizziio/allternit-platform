#!/usr/bin/env python3
"""
Canvas LMS Course Uploader for A://AI-101
Automates the upload of all course content to Canvas LMS
"""

import argparse
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

COURSE_DIR = Path(__file__).parent

PAGES = {
    "Home Page": "home-page.html",
    "Syllabus": "syllabus.html",
    "Resources": "resources.html",
}

MODULES = [
    {
        "name": "Module 1: Foundations of AI",
        "overview_file": "modules/module-01-overview.html",
        "full_file": "modules/complete/module-01-full.html",
    },
    {
        "name": "Module 2: Machine Learning Basics",
        "overview_file": "modules/module-02-overview.html",
        "full_file": "modules/complete/module-02-full.html",
    },
    {
        "name": "Module 3: Supervised Learning",
        "overview_file": "modules/module-03-overview.html",
        "full_file": "modules/complete/module-03-full.html",
    },
    {
        "name": "Module 4: Neural Networks",
        "overview_file": "modules/module-04-overview.html",
        "full_file": "modules/complete/module-04-full.html",
    },
    {
        "name": "Module 5: Deep Learning",
        "overview_file": "modules/module-05-overview.html",
        "full_file": "modules/complete/module-05-full.html",
    },
    {
        "name": "Module 6: NLP & Transformers",
        "overview_file": "modules/module-06-overview.html",
        "full_file": "modules/complete/module-06-full.html",
    },
]


def read_html_file(filename):
    filepath = COURSE_DIR / filename
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        print(f"Warning: File not found: {filepath}")
        return None


def login(page, email, password, base_url):
    print(f"Logging into Canvas at {base_url}...")
    page.goto(f"{base_url}/login/canvas")
    page.wait_for_load_state("networkidle")
    
    page.fill('input#pseudonym_session_unique_id', email)
    page.fill('input#pseudonym_session_password', password)
    page.click('input[type="submit"]')
    
    page.wait_for_load_state("networkidle")
    
    if "/login" in page.url:
        raise Exception("Login failed. Check credentials.")
    
    print("Logged in successfully")


def create_page(page, base_url, course_id, title, content):
    print(f"  Creating page: {title}")
    
    page.goto(f"{base_url}/courses/{course_id}/pages")
    page.wait_for_load_state("networkidle")
    
    page.click('a:has-text("+ Page")')
    page.wait_for_load_state("networkidle")
    
    page.fill('input[name="title"]', title)
    
    try:
        page.click('text=HTML Editor')
        page.wait_for_timeout(500)
    except:
        pass
    
    try:
        page.fill('textarea[name="body"]', content)
    except:
        page.evaluate(f'document.querySelector("textarea[name=\\'body\\']").value = {repr(content)}')
    
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    
    print(f"  Created: {title}")


def create_module(page, base_url, course_id, module_name):
    print(f"Creating module: {module_name}")
    
    page.goto(f"{base_url}/courses/{course_id}/modules")
    page.wait_for_load_state("networkidle")
    
    page.click('button:has-text("+ Module")')
    page.wait_for_timeout(500)
    
    page.fill('input[name="name"]', module_name)
    page.click('button[type="submit"]:has-text("Create Module")')
    page.wait_for_load_state("networkidle")
    
    print(f"  Created module: {module_name}")


def upload_course(email, password, course_id, base_url, headless=False):
    print("=" * 60)
    print("A://AI-101 Canvas Course Uploader")
    print("=" * 60)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()
        
        try:
            login(page, email, password, base_url)
            
            print("\nCreating main pages...")
            for title, filename in PAGES.items():
                content = read_html_file(filename)
                if content:
                    create_page(page, base_url, course_id, title, content)
            
            print("\nCreating modules...")
            for module in MODULES:
                create_module(page, base_url, course_id, module["name"])
                
                overview_content = read_html_file(module["overview_file"])
                if overview_content:
                    create_page(page, base_url, course_id, f"{module['name']} - Overview", overview_content)
                
                full_content = read_html_file(module["full_file"])
                if full_content:
                    create_page(page, base_url, course_id, f"{module['name']} - Content", full_content)
            
            print("\n" + "=" * 60)
            print("Course upload completed!")
            print("=" * 60)
            
        except Exception as e:
            print(f"\nError: {e}")
            page.screenshot(path=str(COURSE_DIR / "error-screenshot.png"))
            raise
        finally:
            browser.close()


def main():
    parser = argparse.ArgumentParser(description="Upload A://AI-101 to Canvas")
    parser.add_argument("--email", help="Canvas email (or CANVAS_EMAIL env var)")
    parser.add_argument("--password", help="Canvas password (or CANVAS_PASSWORD env var)")
    parser.add_argument("--course-id", help="Course ID (or CANVAS_COURSE_ID env var)")
    parser.add_argument("--base-url", default="https://canvas.instructure.com", help="Canvas URL")
    parser.add_argument("--headless", action="store_true", help="Headless mode")
    
    args = parser.parse_args()
    
    email = args.email or os.environ.get("CANVAS_EMAIL")
    password = args.password or os.environ.get("CANVAS_PASSWORD")
    course_id = args.course_id or os.environ.get("CANVAS_COURSE_ID")
    
    if not email or not password or not course_id:
        print("Error: Credentials and course ID required")
        print("Usage: python canvas_uploader.py --email EMAIL --password PASS --course-id ID")
        sys.exit(1)
    
    upload_course(email, password, course_id, args.base_url, args.headless)


if __name__ == "__main__":
    main()

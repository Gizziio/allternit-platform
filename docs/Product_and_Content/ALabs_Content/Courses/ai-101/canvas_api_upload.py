#!/usr/bin/env python3
"""
Canvas LMS Course Upload Script
Uses Canvas API to upload A://AI-101 course content
"""

import requests
import json
import os
import re
from pathlib import Path

# Canvas Configuration
CANVAS_TOKEN = "7~rPDcCXrVEvBrN6TDGQVDNm2uAxKxGe4cnc2TvuTXUAxEEAKTBEWVUTLTvyaJC2hc"
CANVAS_BASE_URL = "https://canvas.instructure.com/api/v1"

# Headers for API requests
headers = {
    "Authorization": f"Bearer {CANVAS_TOKEN}",
    "Content-Type": "application/json"
}

def get_course(course_id):
    """Get course details"""
    url = f"{CANVAS_BASE_URL}/courses/{course_id}"
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Error getting course: {response.status_code}")
        print(response.text)
        return None

def list_pages(course_id):
    """List all pages in course"""
    url = f"{CANVAS_BASE_URL}/courses/{course_id}/pages"
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Error listing pages: {response.status_code}")
        return []

def create_or_update_page(course_id, page_url, title, body):
    """Create or update a wiki page"""
    # First try to update existing page
    url = f"{CANVAS_BASE_URL}/courses/{course_id}/pages/{page_url}"
    
    data = {
        "wiki_page": {
            "title": title,
            "body": body,
            "published": True
        }
    }
    
    response = requests.put(url, headers=headers, json=data)
    
    if response.status_code == 404:
        # Page doesn't exist, create it
        url = f"{CANVAS_BASE_URL}/courses/{course_id}/pages"
        response = requests.post(url, headers=headers, json=data)
    
    if response.status_code in [200, 201]:
        print(f"  ✓ Page '{title}' created/updated")
        return response.json()
    else:
        print(f"  ✗ Error with page '{title}': {response.status_code}")
        print(f"    {response.text[:200]}")
        return None

def list_modules(course_id):
    """List all modules in course"""
    url = f"{CANVAS_BASE_URL}/courses/{course_id}/modules"
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Error listing modules: {response.status_code}")
        return []

def create_module(course_id, name, position=1):
    """Create a new module"""
    url = f"{CANVAS_BASE_URL}/courses/{course_id}/modules"
    
    data = {
        "module": {
            "name": name,
            "position": position,
            "published": True
        }
    }
    
    response = requests.post(url, headers=headers, json=data)
    
    if response.status_code == 200:
        print(f"  ✓ Module '{name}' created")
        return response.json()
    else:
        print(f"  ✗ Error creating module '{name}': {response.status_code}")
        print(f"    {response.text[:200]}")
        return None

def add_module_item(course_id, module_id, item_type, content_id, title):
    """Add an item to a module"""
    url = f"{CANVAS_BASE_URL}/courses/{course_id}/modules/{module_id}/items"
    
    data = {
        "module_item": {
            "title": title,
            "type": item_type,
            "content_id": content_id,
            "published": True
        }
    }
    
    # For pages, we need the page_url not content_id
    if item_type == "Page":
        data["module_item"]["page_url"] = content_id
        del data["module_item"]["content_id"]
    
    response = requests.post(url, headers=headers, json=data)
    
    if response.status_code == 200:
        print(f"    ✓ Added '{title}' to module")
        return response.json()
    else:
        print(f"    ✗ Error adding item: {response.status_code}")
        return None

def read_html_file(filename):
    """Read HTML content from file"""
    filepath = Path(__file__).parent / filename
    if filepath.exists():
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    else:
        print(f"  ✗ File not found: {filename}")
        return None

def upload_course_content(course_id):
    """Upload all course content to Canvas"""
    
    print("=" * 60)
    print("A://AI-101 Course Upload to Canvas")
    print("=" * 60)
    print()
    
    # Verify course exists
    print("1. Verifying course...")
    course = get_course(course_id)
    if not course:
        print("   ✗ Could not access course. Check course ID and permissions.")
        return False
    print(f"   ✓ Course: {course.get('name', 'Unknown')}")
    print()
    
    # Upload main pages
    print("2. Uploading main pages...")
    pages_to_upload = [
        ("home-page", "A://AI-101 Home", "home-page.html"),
        ("syllabus", "Syllabus", "syllabus.html"),
        ("resources", "Resources", "resources.html"),
    ]
    
    for page_url, title, filename in pages_to_upload:
        print(f"   Uploading: {title}")
        body = read_html_file(filename)
        if body:
            create_or_update_page(course_id, page_url, title, body)
    print()
    
    # Upload module overview pages
    print("3. Uploading module overview pages...")
    for i in range(1, 7):
        page_url = f"module-0{i}-overview"
        title = f"Module {i} Overview"
        filename = f"modules/module-0{i}-overview.html"
        
        print(f"   Uploading: {title}")
        body = read_html_file(filename)
        if body:
            create_or_update_page(course_id, page_url, title, body)
    print()
    
    # Upload full module content pages
    print("4. Uploading module lesson content...")
    module_content = [
        ("module-01-content", "Module 1: Foundations of AI", "modules/complete/module-01-full.html"),
        ("module-02-content", "Module 2: Machine Learning Basics", "modules/complete/module-02-full.html"),
        ("module-03-content", "Module 3: Supervised Learning", "modules/complete/module-03-full.html"),
        ("module-04-content", "Module 4: Neural Networks", "modules/complete/module-04-full.html"),
        ("module-05-content", "Module 5: Deep Learning", "modules/complete/module-05-full.html"),
        ("module-06-content", "Module 6: NLP & Transformers", "modules/complete/module-06-full.html"),
    ]
    
    for page_url, title, filename in module_content:
        print(f"   Uploading: {title}")
        body = read_html_file(filename)
        if body:
            create_or_update_page(course_id, page_url, title, body)
    print()
    
    # Create modules
    print("5. Creating modules...")
    modules = [
        ("Module 1: Foundations of AI", 1),
        ("Module 2: Machine Learning Basics", 2),
        ("Module 3: Supervised Learning", 3),
        ("Module 4: Neural Networks", 4),
        ("Module 5: Deep Learning", 5),
        ("Module 6: NLP & Transformers", 6),
    ]
    
    for name, position in modules:
        print(f"   Creating: {name}")
        create_module(course_id, name, position)
    print()
    
    print("=" * 60)
    print("Upload complete!")
    print("=" * 60)
    print()
    print("Note: You will need to manually:")
    print("  - Add module items (pages) to each module")
    print("  - Create quizzes and discussions")
    print("  - Set up assignments and rubrics")
    print()
    
    return True

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python canvas_api_upload.py <course_id>")
        print("Example: python canvas_api_upload.py 12345")
        print()
        print("Or set COURSE_ID environment variable:")
        print("  COURSE_ID=12345 python canvas_api_upload.py")
        sys.exit(1)
    
    course_id = sys.argv[1]
    
    # Also check environment variable
    if course_id == "env" or course_id is None:
        course_id = os.environ.get("COURSE_ID")
    
    if not course_id:
        print("Error: Course ID required")
        sys.exit(1)
    
    upload_course_content(course_id)

#!/usr/bin/env python3
"""
Add pages to modules in Canvas
"""

import requests
import json

CANVAS_TOKEN = "7~rPDcCXrVEvBrN6TDGQVDNm2uAxKxGe4cnc2TvuTXUAxEEAKTBEWVUTLTvyaJC2hc"
CANVAS_BASE_URL = "https://canvas.instructure.com/api/v1"

headers = {
    "Authorization": f"Bearer {CANVAS_TOKEN}",
    "Content-Type": "application/json"
}

def list_modules(course_id):
    url = f"{CANVAS_BASE_URL}/courses/{course_id}/modules"
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        return response.json()
    return []

def add_module_item(course_id, module_id, title, page_url, position=1):
    """Add a page to a module"""
    url = f"{CANVAS_BASE_URL}/courses/{course_id}/modules/{module_id}/items"
    
    data = {
        "module_item": {
            "title": title,
            "type": "Page",
            "page_url": page_url,
            "position": position,
            "published": True
        }
    }
    
    response = requests.post(url, headers=headers, json=data)
    
    if response.status_code == 200:
        print(f"    ✓ Added '{title}'")
        return response.json()
    else:
        print(f"    ✗ Error: {response.status_code} - {response.text[:150]}")
        return None

def organize_modules(course_id):
    print("=" * 60)
    print("Organizing Module Items")
    print("=" * 60)
    print()
    
    # Get modules
    print("1. Fetching modules...")
    modules = list_modules(course_id)
    
    if not modules:
        print("   No modules found!")
        return
    
    # Create a mapping of module names to IDs
    module_map = {m['name']: m['id'] for m in modules}
    print(f"   Found {len(modules)} modules")
    print()
    
    # Define module structure
    module_structure = [
        {
            "name": "Module 1: Foundations of AI",
            "items": [
                ("Module 1 Overview", "module-01-overview", 1),
                ("1.1 - Foundations of AI", "module-01-content", 2),
            ]
        },
        {
            "name": "Module 2: Machine Learning Basics",
            "items": [
                ("Module 2 Overview", "module-02-overview", 1),
                ("2.1 - Machine Learning Basics", "module-02-content", 2),
            ]
        },
        {
            "name": "Module 3: Supervised Learning",
            "items": [
                ("Module 3 Overview", "module-03-overview", 1),
                ("3.1 - Supervised Learning", "module-03-content", 2),
            ]
        },
        {
            "name": "Module 4: Neural Networks",
            "items": [
                ("Module 4 Overview", "module-04-overview", 1),
                ("4.1 - Neural Networks", "module-04-content", 2),
            ]
        },
        {
            "name": "Module 5: Deep Learning",
            "items": [
                ("Module 5 Overview", "module-05-overview", 1),
                ("5.1 - Deep Learning", "module-05-content", 2),
            ]
        },
        {
            "name": "Module 6: NLP & Transformers",
            "items": [
                ("Module 6 Overview", "module-06-overview", 1),
                ("6.1 - NLP & Transformers", "module-06-content", 2),
            ]
        },
    ]
    
    print("2. Adding items to modules...")
    for module in module_structure:
        module_name = module["name"]
        if module_name not in module_map:
            print(f"   Module '{module_name}' not found, skipping...")
            continue
        
        module_id = module_map[module_name]
        print(f"   {module_name}:")
        
        for title, page_url, position in module["items"]:
            add_module_item(course_id, module_id, title, page_url, position)
    
    # Add shared pages to first module as references
    print()
    print("3. Adding shared pages reference...")
    if module_structure:
        first_module_id = module_map.get(module_structure[0]["name"])
        if first_module_id:
            print(f"   Adding to first module:")
            add_module_item(course_id, first_module_id, "Course Home", "home-page", 10)
            add_module_item(course_id, first_module_id, "Syllabus", "syllabus", 11)
            add_module_item(course_id, first_module_id, "Resources", "resources", 12)
    
    print()
    print("=" * 60)
    print("Organization complete!")
    print("=" * 60)

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python add_module_items.py <course_id>")
        sys.exit(1)
    
    course_id = sys.argv[1]
    organize_modules(course_id)

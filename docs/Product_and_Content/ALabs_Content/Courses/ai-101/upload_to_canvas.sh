#!/bin/bash
# Canvas LMS Upload Script using agent-browser
# Usage: ./upload_to_canvas.sh <email> <password> <course_id> [base_url]

set -e

EMAIL="${1:-$CANVAS_EMAIL}"
PASSWORD="${2:-$CANVAS_PASSWORD}"
COURSE_ID="${3:-$CANVAS_COURSE_ID}"
BASE_URL="${4:-https://canvas.instructure.com}"

if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ] || [ -z "$COURSE_ID" ]; then
    echo "Error: Canvas credentials and course ID are required"
    echo "Usage: $0 <email> <password> <course_id> [base_url]"
    echo "Or set environment variables: CANVAS_EMAIL, CANVAS_PASSWORD, CANVAS_COURSE_ID"
    exit 1
fi

echo "========================================"
echo "A://AI-101 Canvas Course Uploader"
echo "========================================"
echo "Canvas URL: $BASE_URL"
echo "Course ID: $COURSE_ID"
echo ""

# Navigate to Canvas and log in
echo "Step 1: Logging into Canvas..."
agent-browser open "${BASE_URL}/login/canvas"
agent-browser fill 'input#pseudonym_session_unique_id' "$EMAIL"
agent-browser fill 'input#pseudonym_session_password' "$PASSWORD"
agent-browser click 'input[type="submit"]'
agent-browser wait 3000

echo "Logged in successfully"
echo ""

# Create main pages
echo "Step 2: Creating main pages..."

# Home Page
echo "  Creating Home Page..."
agent-browser open "${BASE_URL}/courses/${COURSE_ID}/pages"
agent-browser click 'a:has-text("+ Page")'
agent-browser wait 2000
agent-browser fill 'input[name="title"]' "Home Page"
agent-browser click 'text=HTML Editor'
agent-browser wait 500
# Read and fill home-page.html content
HOME_CONTENT=$(cat home-page.html)
agent-browser fill 'textarea[name="body"]' "$HOME_CONTENT"
agent-browser click 'button[type="submit"]'
agent-browser wait 3000
echo "  Home Page created"

# Syllabus
echo "  Creating Syllabus..."
agent-browser open "${BASE_URL}/courses/${COURSE_ID}/pages"
agent-browser click 'a:has-text("+ Page")'
agent-browser wait 2000
agent-browser fill 'input[name="title"]' "Syllabus"
agent-browser click 'text=HTML Editor'
agent-browser wait 500
SYLLABUS_CONTENT=$(cat syllabus.html)
agent-browser fill 'textarea[name="body"]' "$SYLLABUS_CONTENT"
agent-browser click 'button[type="submit"]'
agent-browser wait 3000
echo "  Syllabus created"

# Resources
echo "  Creating Resources..."
agent-browser open "${BASE_URL}/courses/${COURSE_ID}/pages"
agent-browser click 'a:has-text("+ Page")'
agent-browser wait 2000
agent-browser fill 'input[name="title"]' "Resources"
agent-browser click 'text=HTML Editor'
agent-browser wait 500
RESOURCES_CONTENT=$(cat resources.html)
agent-browser fill 'textarea[name="body"]' "$RESOURCES_CONTENT"
agent-browser click 'button[type="submit"]'
agent-browser wait 3000
echo "  Resources created"

echo ""
echo "Step 3: Creating modules..."

# Module 1
echo "  Creating Module 1..."
agent-browser open "${BASE_URL}/courses/${COURSE_ID}/modules"
agent-browser click 'button:has-text("+ Module")'
agent-browser wait 500
agent-browser fill 'input[name="name"]' "Module 1: Foundations of AI"
agent-browser click 'button:has-text("Create Module")'
agent-browser wait 3000

# Create Module 1 Overview page
echo "    Creating Module 1 Overview..."
agent-browser open "${BASE_URL}/courses/${COURSE_ID}/pages"
agent-browser click 'a:has-text("+ Page")'
agent-browser wait 2000
agent-browser fill 'input[name="title"]' "Module 1 Overview"
agent-browser click 'text=HTML Editor'
agent-browser wait 500
M1_CONTENT=$(cat modules/module-01-overview.html)
agent-browser fill 'textarea[name="body"]' "$M1_CONTENT"
agent-browser click 'button[type="submit"]'
agent-browser wait 3000

# Module 2
echo "  Creating Module 2..."
agent-browser open "${BASE_URL}/courses/${COURSE_ID}/modules"
agent-browser click 'button:has-text("+ Module")'
agent-browser wait 500
agent-browser fill 'input[name="name"]' "Module 2: Machine Learning Basics"
agent-browser click 'button:has-text("Create Module")'
agent-browser wait 3000

echo "    Creating Module 2 Overview..."
agent-browser open "${BASE_URL}/courses/${COURSE_ID}/pages"
agent-browser click 'a:has-text("+ Page")'
agent-browser wait 2000
agent-browser fill 'input[name="title"]' "Module 2 Overview"
agent-browser click 'text=HTML Editor'
agent-browser wait 500
M2_CONTENT=$(cat modules/module-02-overview.html)
agent-browser fill 'textarea[name="body"]' "$M2_CONTENT"
agent-browser click 'button[type="submit"]'
agent-browser wait 3000

# Module 3
echo "  Creating Module 3..."
agent-browser open "${BASE_URL}/courses/${COURSE_ID}/modules"
agent-browser click 'button:has-text("+ Module")'
agent-browser wait 500
agent-browser fill 'input[name="name"]' "Module 3: Supervised Learning"
agent-browser click 'button:has-text("Create Module")'
agent-browser wait 3000

echo "    Creating Module 3 Overview..."
agent-browser open "${BASE_URL}/courses/${COURSE_ID}/pages"
agent-browser click 'a:has-text("+ Page")'
agent-browser wait 2000
agent-browser fill 'input[name="title"]' "Module 3 Overview"
agent-browser click 'text=HTML Editor'
agent-browser wait 500
M3_CONTENT=$(cat modules/module-03-overview.html)
agent-browser fill 'textarea[name="body"]' "$M3_CONTENT"
agent-browser click 'button[type="submit"]'
agent-browser wait 3000

# Module 4
echo "  Creating Module 4..."
agent-browser open "${BASE_URL}/courses/${COURSE_ID}/modules"
agent-browser click 'button:has-text("+ Module")'
agent-browser wait 500
agent-browser fill 'input[name="name"]' "Module 4: Neural Networks"
agent-browser click 'button:has-text("Create Module")'
agent-browser wait 3000

echo "    Creating Module 4 Overview..."
agent-browser open "${BASE_URL}/courses/${COURSE_ID}/pages"
agent-browser click 'a:has-text("+ Page")'
agent-browser wait 2000
agent-browser fill 'input[name="title"]' "Module 4 Overview"
agent-browser click 'text=HTML Editor'
agent-browser wait 500
M4_CONTENT=$(cat modules/module-04-overview.html)
agent-browser fill 'textarea[name="body"]' "$M4_CONTENT"
agent-browser click 'button[type="submit"]'
agent-browser wait 3000

# Module 5
echo "  Creating Module 5..."
agent-browser open "${BASE_URL}/courses/${COURSE_ID}/modules"
agent-browser click 'button:has-text("+ Module")'
agent-browser wait 500
agent-browser fill 'input[name="name"]' "Module 5: Deep Learning"
agent-browser click 'button:has-text("Create Module")'
agent-browser wait 3000

echo "    Creating Module 5 Overview..."
agent-browser open "${BASE_URL}/courses/${COURSE_ID}/pages"
agent-browser click 'a:has-text("+ Page")'
agent-browser wait 2000
agent-browser fill 'input[name="title"]' "Module 5 Overview"
agent-browser click 'text=HTML Editor'
agent-browser wait 500
M5_CONTENT=$(cat modules/module-05-overview.html)
agent-browser fill 'textarea[name="body"]' "$M5_CONTENT"
agent-browser click 'button[type="submit"]'
agent-browser wait 3000

# Module 6
echo "  Creating Module 6..."
agent-browser open "${BASE_URL}/courses/${COURSE_ID}/modules"
agent-browser click 'button:has-text("+ Module")'
agent-browser wait 500
agent-browser fill 'input[name="name"]' "Module 6: NLP & Transformers"
agent-browser click 'button:has-text("Create Module")'
agent-browser wait 3000

echo "    Creating Module 6 Overview..."
agent-browser open "${BASE_URL}/courses/${COURSE_ID}/pages"
agent-browser click 'a:has-text("+ Page")'
agent-browser wait 2000
agent-browser fill 'input[name="title"]' "Module 6 Overview"
agent-browser click 'text=HTML Editor'
agent-browser wait 500
M6_CONTENT=$(cat modules/module-06-overview.html)
agent-browser fill 'textarea[name="body"]' "$M6_CONTENT"
agent-browser click 'button[type="submit"]'
agent-browser wait 3000

echo ""
echo "========================================"
echo "Upload complete!"
echo "========================================"

# Close browser
agent-browser close

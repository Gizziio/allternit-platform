#!/bin/bash
# Phase 1 Keeper Courses - Must Download First

echo "Opening Phase 1 enrollment URLs (6 courses)..."

# n8n Automation (3 courses)
open -na "Google Chrome" --args --new-tab "https://www.udemy.com/course/master-n8n-automations-in-2-hours/"
open -na "Google Chrome" --args --new-tab "https://www.udemy.com/course/n8n-for-beginners-lead-generation-automation-ai-agents/"
open -na "Google Chrome" --args --new-tab "https://www.udemy.com/course/build-ai-agents-with-n8n-free-hands-on-training/"

# RAG (1 course)
open -na "Google Chrome" --args --new-tab "https://www.udemy.com/course/learn-rag-with-llmware-2024/"

# Copilot (2 courses)
open -na "Google Chrome" --args --new-tab "https://www.udemy.com/course/master-github-copilot-basic-to-advanced/"
open -na "Google Chrome" --args --new-tab "https://www.udemy.com/course/github-copilot-for-beginners-ai-coding-crash-course/"

echo "Done. Please click 'Enroll' on each of the 6 tabs, then run:"
echo "  tsx scripts/udemy-pipeline.ts"

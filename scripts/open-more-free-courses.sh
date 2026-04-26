#!/bin/bash
# Open additional free AI courses in Chrome for enrollment

COURSES=(
  "https://www.udemy.com/course/machine-learning-fundamentals-python/"
  "https://www.udemy.com/course/machine-learning-with-python-o/"
  "https://www.udemy.com/course/the-complete-course-for-ai-agent-with-no-code-tool-2025/"
  "https://www.udemy.com/course/quantum-machine-learning-course-with-python-2025/"
  "https://www.udemy.com/course/the-complete-python-course-for-beginners-to-advance/"
  "https://www.udemy.com/course/ai-tools-for-productivity-time-management-2025/"
  "https://www.udemy.com/course/free-prompt-engineering-masterclass-5-practical-examples/"
  "https://www.udemy.com/course/a-beginner-guide-to-prompt-engineering-for-developers/"
  "https://www.udemy.com/course/prompt-engineering-for-developers/"
  "https://www.udemy.com/course/generative-ai-for-leaders/"
  "https://www.udemy.com/course/ai-for-everyone/"
  "https://www.udemy.com/course/artificial-intelligence-for-humans/"
  "https://www.udemy.com/course/ai-and-crypto-2025/"
  "https://www.udemy.com/course/ai-filmmaking/"
  "https://www.udemy.com/course/ai-art-generation-guide/"
)

for url in "${COURSES[@]}"; do
  open -a "Google Chrome" "$url"
  sleep 0.5
done

echo "Opened ${#COURSES[@]} free AI course tabs in Chrome"

import re
from collections import defaultdict

file_path = 'react-doctor-full.txt'
with open(file_path, 'r') as f:
    lines = f.readlines()

issues = defaultdict(list)
current_issue_type = None

for line in lines:
    line = line.strip()
    if line.startswith('✗') or line.startswith('⚠'):
        current_issue_type = line
    elif line.startswith('src/') and current_issue_type:
        issues[current_issue_type].append(line)

print("--- Effect needs cleanup ---")
for issue in issues:
    if 'Effect needs cleanup' in issue:
        for file in issues[issue]:
            print(file)

print("\n--- Rules of hooks ---")
for issue in issues:
    if 'Rules of hooks' in issue:
        for file in issues[issue]:
            print(file)

print("\n--- Hydration mismatch ---")
for issue in issues:
    if 'Rendering hydration mismatch' in issue:
        for file in issues[issue]:
            print(file)

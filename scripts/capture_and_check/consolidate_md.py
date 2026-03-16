import os
import glob
import shutil

root_dir = "/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech"
spec_dir = os.path.join(root_dir, "spec")
archive_dir = os.path.join(root_dir, "_archive")

os.makedirs(spec_dir, exist_ok=True)
os.makedirs(archive_dir, exist_ok=True)

md_files = glob.glob(os.path.join(root_dir, "*.md"))

exclude_files = ["README.md", "README copy.md"]

master_doc = os.path.join(spec_dir, "00-MASTER_ARCHITECTURE_INDEX.md")

with open(master_doc, "w") as f:
    f.write("# Master Architecture & Archiving Index\n\n")
    f.write("This document summarizes the consolidated root markdown files.\n\n")

categorized = {
    "done": [],
    "uncompleted": [],
    "orphaned_drift": []
}

for filepath in md_files:
    filename = os.path.basename(filepath)
    if filename in exclude_files:
        if filename == "README copy.md":
            shutil.move(filepath, os.path.join(archive_dir, filename))
        continue

    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    lower_content = content.lower()
    
    # Simple heuristic
    if "complete" in filename.lower() or "final" in filename.lower() or "summary" in filename.lower() or "status" in filename.lower():
        categorized["done"].append(filename)
    elif "plan" in filename.lower() or "dag" in filename.lower() or "todo" in filename.lower() or "roadmap" in filename.lower() or "remaining" in filename.lower():
        categorized["uncompleted"].append(filename)
    else:
        categorized["orphaned_drift"].append(filename)

    # Move to archive
    shutil.move(filepath, os.path.join(archive_dir, filename))

with open(master_doc, "a") as f:
    f.write("## Completed & Summaries\n")
    for name in categorized["done"]:
        f.write(f"- {name}\n")
        
    f.write("\n## Plans & Uncompleted\n")
    for name in categorized["uncompleted"]:
        f.write(f"- {name}\n")
        
    f.write("\n## Orphaned / General / Drift\n")
    for name in categorized["orphaned_drift"]:
        f.write(f"- {name}\n")

print("Consolidation and archiving complete.")

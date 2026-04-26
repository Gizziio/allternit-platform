import json
import glob
import os

files = glob.glob(".allternit/wih/T0*.wih.json")
print(f"Found {len(files)} WIH files to check.")

for file_path in files:
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    modified = False
    
    # Fix root memory
    if "memory" not in data:
        data["memory"] = {}
    if not data["memory"].get("packs"):
        data["memory"]["packs"] = [{"pack_id": "law", "layers": ["law"], "access": "read"}]
        modified = True
        print(f"Fixed root memory in {file_path}")

    # Fix beads memory
    if "beads" in data:
        if "memory" not in data["beads"]:
            data["beads"]["memory"] = {}
        if not data["beads"]["memory"].get("packs"):
            data["beads"]["memory"]["packs"] = [{"pack_id": "law", "layers": ["law"], "access": "read"}]
            modified = True
            print(f"Fixed beads memory in {file_path}")

    if modified:
        with open(file_path, 'w') as f:
            json.dump(data, f, indent=2)

print("Done.")

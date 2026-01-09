
import os

filepath = r"c:\Workspaces\CodeGradeAI\frontend\App.tsx"

try:
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    counts = {}
    tokens = ["const [profileNewAvatar", "const [profileEmail", "const [profileFullName", "const [profilePassData"]
    
    print(f"Total lines: {len(lines)}")
    
    for i, line in enumerate(lines):
        for token in tokens:
            if token in line:
                print(f"Found {token} at line {i+1}")
                counts[token] = counts.get(token, 0) + 1

    for token, count in counts.items():
        if count > 1:
            print(f"DUPLICATE DETECTED: {token} appears {count} times!")
        else:
            print(f"OK: {token} appears {count} times.")

except Exception as e:
    print(f"Error: {e}")

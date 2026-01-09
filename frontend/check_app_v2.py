
import os

filepath = r"c:\Workspaces\CodeGradeAI\frontend\App.tsx"

try:
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    target = "const renderProfileView"
    count = 0
    
    print(f"Checking for duplicate declarations of '{target}'...")
    
    for i, line in enumerate(lines):
        if target in line:
            print(f"Found at line {i+1}: {line.strip()}")
            count += 1
            
    if count > 1:
        print(f"DUPLICATE DETECTED: Found {count} instances!")
    else:
        print(f"Clean: Found {count} instance.")

except Exception as e:
    print(f"Error: {e}")

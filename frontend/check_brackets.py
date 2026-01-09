
import re

filepath = r"c:\Workspaces\CodeGradeAI\frontend\App.tsx"

try:
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()

    # Naive string removal (doesn't handle escaping but good enough for rough check)
    text = re.sub(r'\"(.*?)\"', '', text)
    text = re.sub(r'\'(.*?)\'', '', text)
    # text = re.sub(r'\`.*?\`', '', text, flags=re.DOTALL) # Backticks regex is tricky with single chars

    open_braces = text.count('{')
    close_braces = text.count('}')
    
    # Check parens
    open_parens = text.count('(')
    close_parens = text.count(')')

    print(f"Braces: +{open_braces} -{close_braces} = {open_braces - close_braces}")
    print(f"Parens: +{open_parens} -{close_parens} = {open_parens - close_parens}")

except Exception as e:
    print(e)

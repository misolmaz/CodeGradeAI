"""
Faz 2 smoke test: calls grade_submission with a sample payload and prints JSON output.
Requires GEMINI_API_KEY or GOOGLE_API_KEY in environment. Skips gracefully if missing.
"""
import asyncio
import json
import os
import sys

from dotenv import load_dotenv

load_dotenv()

from app.schemas import SubmissionRequest
from app.services import API_KEY, grade_submission


async def main() -> int:
    if not API_KEY:
        print("SKIP: GEMINI_API_KEY / GOOGLE_API_KEY not set — live AI test skipped.")
        return 0

    request = SubmissionRequest(
        assignmentDescription="1'den 10'a kadar (10 dahil) sayıları ekrana yazdır.",
        assignmentLanguage="Python",
        studentCode="for i in range(1, 10):\n    print(i)",
        studentLevel="beginner",
    )

    print("Calling grade_submission...")
    result = await grade_submission(request)
    print(json.dumps(result.model_dump(), indent=2, ensure_ascii=False))

    checks = {
        "rubricScores": result.rubricScores is not None,
        "errorFindings": result.errorFindings is not None and len(result.errorFindings) > 0,
        "socraticFeedback": result.socraticFeedback is not None,
        "pedagogicalMetadata": result.pedagogicalMetadata is not None,
    }
    print("\nField presence:", checks)
    return 0 if all(checks.values()) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

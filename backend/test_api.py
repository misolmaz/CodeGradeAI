from fastapi.testclient import TestClient
from app.main import app
from app.schemas import GradingResult

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "CodeGradeAI Backend is running", "status": "active"}

def test_grade_requires_auth():
    # YAYIN 016: /api/grade kimlik doğrulaması ister (ayrıntılı testler: tests/test_study016.py)
    response = client.post("/api/grade", json={
        "assignmentDescription": "Write a hello world function",
        "assignmentLanguage": "python",
        "studentCode": "def hello(): print('Hello')",
        "studentLevel": "beginner"
    })
    assert response.status_code == 401

if __name__ == "__main__":
    # verification script to run directly
    try:
        test_read_root()
        test_grade_requires_auth()
        print("✅ All Tests Passed!")
    except AssertionError as e:
        print(f"❌ Test Failed: {e}")
    except Exception as e:
        print(f"❌ Error during testing: {e}")

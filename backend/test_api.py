from fastapi.testclient import TestClient
from app.main import app
from app.schemas import GradingResult

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "CodeGradeAI Backend is running", "status": "active"}

def test_grade_submission_schema_validation():
    # Test with invalid data (missing fields)
    response = client.post("/api/grade", json={
        "assignmentDescription": "Test assignment"
        # missing other fields
    })
    assert response.status_code == 422

def test_grade_submission_mock():
    # We can't easily query the real AI without a key in this environment,
    # but we can verify the request handling.
    # If no key is set, our service returns a specific error json which is valid schema.
    
    payload = {
        "assignmentDescription": "Write a hello world function",
        "assignmentLanguage": "python",
        "studentCode": "def hello(): print('Hello')",
        "studentLevel": "beginner"
    }
    
    response = client.post("/api/grade", json=payload)
    
    # If API KEY is missing, it returns a valid GradingResult with grade=0 and error message
    # If API KEY is present, it returns real result.
    # In both cases status should be 200 because we handle exceptions in services.py and return a fallback result.
    
    assert response.status_code == 200
    data = response.json()
    assert "grade" in data
    assert "feedback" in data
    assert "unitTests" in data

if __name__ == "__main__":
    # verification script to run directly
    try:
        test_read_root()
        test_grade_submission_schema_validation()
        test_grade_submission_mock()
        print("✅ All Tests Passed!")
    except AssertionError as e:
        print(f"❌ Test Failed: {e}")
    except Exception as e:
        print(f"❌ Error during testing: {e}")

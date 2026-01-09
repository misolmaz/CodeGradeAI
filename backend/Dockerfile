# Backend Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create an empty db file if it doesn't exist
RUN touch sql_app.db

EXPOSE 8000

CMD ["sh", "-c", "python seed_admin.py && uvicorn app.main:app --host 0.0.0.0 --port 8000"]

# Use official lightweight Python image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Set environment variables to prevent Python from writing pyc files and buffering stdout
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies (if any needed for specific python packages)
# RUN apt-get update && apt-get install -y gcc

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose the port (informative only, Cloud Run ignores this)
EXPOSE 8080

# Command to run the application
# We use shell form to expand the $PORT variable properly
CMD sh -c "uvicorn app.main:app --host 0.0.0.0 --port \${PORT:-8000}"

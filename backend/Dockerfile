FROM python:3.12-slim

WORKDIR /app

# psycopg2-binary already bundles its own libpq — no system deps needed
# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code (overridden by volume in dev)
COPY . .

# Start server
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

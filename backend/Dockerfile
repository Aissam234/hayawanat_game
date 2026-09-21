FROM python:3.12-slim

WORKDIR /app

# psycopg2-binary already bundles its own libpq — no system deps needed
# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code (overridden by volume in dev)
COPY . .

# Start server
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --ws websockets --ws-max-size 393216 --ws-max-queue 4 --ws-per-message-deflate false"]

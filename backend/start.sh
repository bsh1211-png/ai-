#!/bin/bash
set -e

echo "Downloading ML model if needed..."
python -m scripts.download_pose_model

echo "Running Alembic migrations..."
alembic upgrade head

echo "Starting server on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"

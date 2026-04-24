#!/bin/sh
set -eu

echo "Stopping old containers if needed..."
docker compose down

echo "Starting IDS dashboard stack..."
docker compose up -d

echo "Deployment command finished."

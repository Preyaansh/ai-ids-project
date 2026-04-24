$ErrorActionPreference = "Stop"

Write-Host "Stopping old containers if needed..."
docker compose down

Write-Host "Starting IDS dashboard stack..."
docker compose up -d

Write-Host "Deployment command finished."

# Sentinel IDS Dashboard

This project is a Dockerized IDS dashboard that reads `ids_logs.json` and renders a live SOC-style monitoring UI.

## How the project works

1. Your IDS pipeline writes newline-delimited JSON events into `ids_logs.json`.
2. The `ids-dashboard` container runs a lightweight Python web server and serves the frontend files:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `ids_logs.json`
3. In the browser, `app.js` fetches `ids_logs.json` every second.
4. The frontend parses `SUMMARY` and `ALERT` events and updates:
   - system status
   - threat level
   - normal / HTTP / SYN traffic
   - active attack panel
   - top IPs
   - alerts table
   - analytics charts

That means Docker is actively used as the runtime that hosts the web application.

## Run locally with Docker

```powershell
docker compose up -d
```

Open:

- `http://127.0.0.1:8082`

## CI/CD Pipeline

This project also includes a Jenkins-based CI/CD pipeline.

Pipeline flow:

1. Developer edits code
2. Developer pushes to GitHub
3. GitHub webhook calls Jenkins through ngrok
4. Jenkins validates the project
5. Jenkins redeploys the Docker app
6. Jenkins smoke-tests the live site and all 4 pages

Files added for CI/CD:

- `Jenkinsfile`
- `scripts/deploy.ps1`
- `CI_CD_SETUP.md`

## Optional: run ngrok inside Docker

If you want the public HTTPS tunnel to also be part of the Docker stack:

1. Copy `.env.example` to `.env`
2. Put your ngrok auth token in `.env`
3. Start the stack with the tunnel profile

```powershell
Copy-Item .env.example .env
docker compose --profile tunnel up -d
```

Then open the ngrok inspection API:

- `http://127.0.0.1:4040/api/tunnels`

The public HTTPS URL will appear there.

## Why Docker counts here

Docker is not cosmetic in this setup.

- It provides the web server runtime using the `ids-dashboard` container
- It packages the frontend in a reproducible environment
- It exposes the app through a container port
- It can also package the public tunnel with the optional `ids-ngrok` service

So the project workflow can be fully containerized if you use the tunnel profile.

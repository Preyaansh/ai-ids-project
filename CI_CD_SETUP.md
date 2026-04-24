# CI/CD Setup Guide

This project supports a simple CI/CD flow:

1. Developer edits code locally
2. Developer runs `git push`
3. GitHub sends a webhook to Jenkins
4. Jenkins pulls the latest code
5. Jenkins validates the project
6. Jenkins redeploys the Dockerized app
7. Jenkins checks that the website is up

## Project files used for CI/CD

- `Jenkinsfile`
- `scripts/deploy.sh`
- `docker-compose.yml`
- `Dockerfile.jenkins`

## Before starting

Make sure these are ready:

- Docker Desktop is running
- Jenkins is running and reachable on `http://127.0.0.1:8081`
- `ngrok` is installed and authenticated
- This project is pushed to a GitHub repository

## Step 1: Put the project into Git

If this folder is not yet a Git repo, run:

```powershell
cd C:\Users\Preyaansh Vij\Desktop\ids_data
git init
git add .
git commit -m "Initial IDS dashboard commit"
```

Then create a GitHub repository and connect it:

```powershell
git remote add origin <your-github-repo-url>
git branch -M main
git push -u origin main
```

Current project remote:

```text
https://github.com/Preyaansh/ai-ids-project.git
```

## Step 2: Create the Jenkins pipeline job

In Jenkins:

1. Create a new item
2. Choose `Pipeline`
3. Under Pipeline definition, choose `Pipeline script from SCM`
4. Select `Git`
5. Paste your repository URL
6. Set branch to `*/main`
7. Script path should be:

```text
Jenkinsfile
```

Recommended Jenkins job name:

```text
ids-dashboard-pipeline
```

## Step 3: Expose Jenkins using ngrok

GitHub must be able to reach Jenkins from the internet.
Since Jenkins is local, expose Jenkins using ngrok:

```powershell
ngrok http 8081
```

This gives a public HTTPS URL like:

```text
https://something.ngrok-free.dev
```

## Step 4: Add GitHub webhook

In your GitHub repository:

1. Go to `Settings`
2. Go to `Webhooks`
3. Click `Add webhook`
4. Payload URL:

```text
https://your-ngrok-url/github-webhook/
```

5. Content type:

```text
application/json
```

6. Choose:

```text
Just the push event
```

7. Save webhook

Important:

- The webhook must point to Jenkins, not the IDS dashboard app
- Your dashboard public link and Jenkins public link are two different ngrok URLs
- If one ngrok session is already running for the dashboard, stop it before starting the Jenkins tunnel unless you intentionally want two tunnels

## Step 5: What Jenkins does on every push

When you push code:

1. GitHub webhook calls Jenkins
2. Jenkins starts the pipeline
3. Jenkins checks out the latest code
4. Jenkins validates:
   - `server.py`
   - `docker compose config`
   - required frontend files exist
5. Jenkins runs:

```sh
./scripts/deploy.sh
```

6. That script:
   - stops the old containers
   - starts the updated Docker app
7. Jenkins runs smoke tests:
   - homepage returns `200`
   - `ids_logs.json` returns `200`
   - all 4 project pages return `200`

If all checks pass, deployment is complete.

## Final flow in one line

Edit code -> `git push` -> GitHub webhook -> Jenkins pipeline -> Docker redeploy -> live app updated
## Step 0: Run Jenkins with Docker access

For this pipeline to redeploy the app, Jenkins must be able to run Docker commands.

Build the custom Jenkins image:

```powershell
cd C:\Users\Preyaansh Vij\Desktop\ids_data
docker build -t ids-jenkins -f Dockerfile.jenkins .
```

Then recreate Jenkins with Docker socket access:

```powershell
docker stop jenkins
docker rm jenkins
docker run -d --name jenkins `
  -u root `
  -p 8081:8080 `
  -p 50001:50000 `
  -v 4bb79733feaf24562887b4e4e94cdc6a3c625bd40757cf9a0d4421d1da080f78:/var/jenkins_home `
  -v /var/run/docker.sock:/var/run/docker.sock `
  ids-jenkins
```

This keeps your existing Jenkins data and jobs, but gives Jenkins access to:

- `docker`
- `docker compose`
- permission to use the Docker socket

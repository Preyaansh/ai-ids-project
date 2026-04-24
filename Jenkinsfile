pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
  }

  environment {
    APP_URL = 'http://127.0.0.1:8082'
    APP_PAGES = 'dashboard.html,monitor.html,alerts.html,analytics.html'
  }

  triggers {
    githubPush()
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Validate') {
      steps {
        powershell 'python -m py_compile server.py'
        powershell 'docker compose config'
        powershell '''
          $required = @(
            "index.html",
            "dashboard.html",
            "monitor.html",
            "alerts.html",
            "analytics.html",
            "app.js",
            "styles.css",
            "server.py",
            "ids_logs.json"
          )

          foreach ($file in $required) {
            if (-not (Test-Path $file)) {
              throw "Missing required project file: $file"
            }
          }
        '''
      }
    }

    stage('Deploy') {
      steps {
        powershell '.\\scripts\\deploy.ps1'
      }
    }

    stage('Smoke Test') {
      steps {
        powershell '''
          $response = Invoke-WebRequest -UseBasicParsing $env:APP_URL
          if ($response.StatusCode -ne 200) {
            throw "App health check failed with status $($response.StatusCode)"
          }

          $logs = Invoke-WebRequest -UseBasicParsing "$env:APP_URL/ids_logs.json"
          if ($logs.StatusCode -ne 200) {
            throw "Log file check failed with status $($logs.StatusCode)"
          }

          $pages = $env:APP_PAGES.Split(",")
          foreach ($page in $pages) {
            $pageResponse = Invoke-WebRequest -UseBasicParsing "$env:APP_URL/$page"
            if ($pageResponse.StatusCode -ne 200) {
              throw "Page check failed for $page with status $($pageResponse.StatusCode)"
            }
          }
        '''
      }
    }
  }

  post {
    success {
      echo 'Deployment complete. IDS dashboard is live.'
    }
    failure {
      echo 'Pipeline failed. Check the build logs for the failing stage.'
    }
  }
}

pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    skipDefaultCheckout()
  }

  environment {
    APP_URL = 'http://127.0.0.1:8082'
    APP_PAGES = 'dashboard.html,monitor.html,alerts.html,analytics.html'
  }

  triggers {
    githubPush()
  }

  stages {
    stage('Sync GitHub Source') {
      steps {
        checkout scm
      }
    }

    stage('Verify App Integrity') {
      steps {
        sh '''
          set -eu
          docker compose config >/dev/null

          required_files="
          index.html
          dashboard.html
          monitor.html
          alerts.html
          analytics.html
          app.js
          styles.css
          server.py
          ids_logs.json
          scripts/deploy.sh
          "

          for file in $required_files; do
            [ -f "$file" ] || { echo "Missing required project file: $file"; exit 1; }
          done

          grep -q "fetch(" app.js
          grep -q "Dashboard" dashboard.html
          grep -q "Live Monitor" monitor.html
          grep -q "Alerts" alerts.html
          grep -q "Analytics" analytics.html
          grep -q "SUMMARY" ids_logs.json
        '''
      }
    }

    stage('Redeploy Dashboard Stack') {
      steps {
        sh 'chmod +x scripts/deploy.sh && ./scripts/deploy.sh'
      }
    }

    stage('Validate Routes And Live Data') {
      steps {
        sh '''
          set -eu

          curl -fsS "$APP_URL/" >/tmp/app_index.html
          grep -qi "dashboard" /tmp/app_index.html

          curl -fsS "$APP_URL/ids_logs.json" >/tmp/ids_logs.json
          grep -q '"event"' /tmp/ids_logs.json
          grep -Eq '"SUMMARY"|"ALERT"' /tmp/ids_logs.json

          OLD_IFS="$IFS"
          IFS=','
          for page in $APP_PAGES; do
            page_file="/tmp/$page"
            curl -fsS "$APP_URL/$page" > "$page_file"
            case "$page" in
              dashboard.html) grep -q "System Status" "$page_file" ;;
              monitor.html) grep -q "Connections Over Time" "$page_file" ;;
              alerts.html) grep -q "Alert Log" "$page_file" ;;
              analytics.html) grep -q "Traffic Statistics" "$page_file" ;;
            esac
          done
          IFS="$OLD_IFS"
        '''
      }
    }
  }
}

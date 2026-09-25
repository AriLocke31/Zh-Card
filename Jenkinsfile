pipeline {
  agent any

  environment {
    AWS_REGION = 'us-east-1'
    LAMBDA_FUNCTION = 'zh-card-words'
  }

  stages {
    stage('Environment') {
      steps {
        sh '''
          node --version
          npm --version
          git --version
          aws --version
          aws sts get-caller-identity
          '''
        }
    }

    stage('Inspect Workspace') {
      steps {
        sh '''
          echo "Current directory:"
          pwd
          '''
      }
    }

    stage('Install') {
      steps {
        dir('src/backend') {
          sh 'npm ci'
        }
      }
    }

    stage('Typecheck') {
      steps {
        dir('src/backend') {
          sh 'npm run typecheck'
        }
      }
    }

    stage('Build') {
      steps {
        dir('src/backend') {
          sh 'npm run build'
        }
      }
    }

    stage('Package') {
      steps {
        dir('src/backend') {
          sh '''
            rm -f lambda.zip
            zip -j lambda.zip dist/index.js
            '''
        }
      }
    }

    stage('Deploy') {
      steps {
        dir('src/backend') {
          sh '''
            aws lambda update-function-code \
              --function-name "$LAMBDA_FUNCTION" \
              --region "$AWS_REGION" \
              --zip-file fileb://lambda.zip

            aws lambda wait function-updated \
              --function-name "$LAMBDA_FUNCTION" \
              --region "$AWS_REGION"
            '''
        }
      }
    }
  }

  post {
    success {
      echo 'Lambda deployment succeeded.'
    }

    failure {
      echo 'Pipeline failed.'
    }

    always {
      archiveArtifacts artifacts: 'src/backend/lambda.zip',
        fingerprint: true,
        allowEmptyArchive: true
    }
  }
}

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

    stage('Install') {
      steps {
        dir('backend') {
          sh 'npm ci'
        }
      }
    }

    stage('Typecheck') {
      steps {
        dir('backend') {
          sh 'npm run typecheck'
        }
      }
    }

    stage('Build') {
      steps {
        dir('backend') {
          sh 'npm run build'
        }
      }
    }

    stage('Package') {
      steps {
        dir('backend') {
          sh '''
            rm -f lambda.zip
            zip -j lambda.zip dist/index.js
            '''
        }
      }
    }

    stage('Deploy') {
      steps {
        dir('backend') {
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
      archiveArtifacts artifacts: 'backend/lambda.zip',
        fingerprint: true,
        allowEmptyArchive: true
    }
  }
}

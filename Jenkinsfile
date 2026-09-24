pipeline {
  agent {
    docker {
      image 'node:22'
    }
  }

  stages {
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
  }
}

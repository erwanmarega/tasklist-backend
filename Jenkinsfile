pipeline {
    agent any

    tools {
        nodejs 'NodeJS-22'
    }

    environment {
        IMAGE_NAME      = 'tasklist-backend'
        IMAGE_TAG       = "${BUILD_NUMBER}"
        DOCKERHUB_CREDS = credentials('dockerhub-credentials')
    }

    stages {

        stage('Install') {
            steps {
                sh 'npm ci'
                sh 'npx prisma generate'
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Unit Tests') {
            steps {
                sh 'npm run test:coverage'
            }
            post {
                always {
                    junit 'reports/junit.xml'
                    publishHTML(target: [
                        allowMissing         : false,
                        alwaysLinkToLastBuild: true,
                        keepAll              : true,
                        reportDir            : 'coverage',
                        reportFiles          : 'index.html',
                        reportName           : 'Coverage Report'
                    ])
                }
            }
        }

        stage('E2E Tests') {
            steps {
                sh 'npm run test:e2e'
            }
        }

        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh 'npx sonar-scanner'
                }
            }
        }


        stage('Docker Build') {
            steps {
                sh "docker build -t ${IMAGE_NAME}:${IMAGE_TAG} -t ${IMAGE_NAME}:latest ."
            }
        }
    }

    post {
        always {
            node('') {
                cleanWs()
            }
        }
        success {
            echo "Pipeline success — image: ${IMAGE_NAME}:${IMAGE_TAG}"
        }
        failure {
            echo "Pipeline failed — check logs"
        }
    }
}

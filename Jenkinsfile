pipeline {
    agent any

    tools {
        nodejs 'NodeJS-22'
    }

    environment {
        IMAGE_NAME      = 'tasklist-backend'
        IMAGE_TAG       = "${BUILD_NUMBER}"
        DOCKERHUB_CREDS = credentials('dockerhub-credentials')
        // Docker Hub namespace comes from the credential username — no name hardcoded.
        IMAGE_REF       = "${DOCKERHUB_CREDS_USR}/tasklist-backend"
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
                sh "docker build -t ${IMAGE_REF}:${IMAGE_TAG} -t ${IMAGE_REF}:latest ."
            }
        }

        stage('SBOM (SPDX)') {
            steps {
                // Generate an SPDX-format SBOM of the built image with Trivy.
                sh "trivy image --format spdx-json --output sbom-spdx.json ${IMAGE_REF}:${IMAGE_TAG}"
            }
            post {
                always {
                    archiveArtifacts artifacts: 'sbom-spdx.json', fingerprint: true
                }
            }
        }

        stage('Trivy Scan') {
            steps {
                // Fail the build on HIGH/CRITICAL OS or library vulnerabilities.
                sh """
                    trivy image \
                        --severity HIGH,CRITICAL \
                        --exit-code 1 \
                        --format table \
                        --output trivy-report.txt \
                        ${IMAGE_REF}:${IMAGE_TAG}
                """
            }
            post {
                always {
                    archiveArtifacts artifacts: 'trivy-report.txt', fingerprint: true
                }
            }
        }

        stage('Docker Push') {
            steps {
                sh 'echo "$DOCKERHUB_CREDS_PSW" | docker login -u "$DOCKERHUB_CREDS_USR" --password-stdin'
                sh "docker push ${IMAGE_REF}:${IMAGE_TAG}"
                sh "docker push ${IMAGE_REF}:latest"
            }
            post {
                always {
                    sh 'docker logout'
                }
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
            echo "Pipeline success — image pushed: ${IMAGE_REF}:${IMAGE_TAG}"
        }
        failure {
            echo "Pipeline failed — check logs"
        }
    }
}

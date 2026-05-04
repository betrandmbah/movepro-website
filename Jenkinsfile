pipeline {
  agent any

  environment {
    AWS_DEFAULT_REGION = 'us-east-1'
    S3_BUCKET = 'REPLACE_WITH_YOUR_FRONTEND_BUCKET'
    BACKEND_HOST = 'REPLACE_WITH_BACKEND_PUBLIC_IP'
    BACKEND_DIR = '/home/ec2-user/movepro-website'
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Backend Install Check') {
      steps {
        dir('backend') {
          sh 'npm install'
        }
      }
    }

    stage('Deploy Frontend to S3') {
      steps {
        dir('frontend') {
          sh 'aws s3 sync . s3://$S3_BUCKET --delete'
        }
      }
    }

    stage('Deploy Backend to EC2') {
      steps {
        sshagent(credentials: ['backend-ec2-key']) {
          sh '''
            ssh -o StrictHostKeyChecking=no ec2-user@$BACKEND_HOST "mkdir -p $BACKEND_DIR"
            rsync -avz --delete -e "ssh -o StrictHostKeyChecking=no" backend/ ec2-user@$BACKEND_HOST:$BACKEND_DIR/backend/
            ssh -o StrictHostKeyChecking=no ec2-user@$BACKEND_HOST "cd $BACKEND_DIR/backend && chmod +x deploy-backend.sh && ./deploy-backend.sh"
          '''
        }
      }
    }
  }
}

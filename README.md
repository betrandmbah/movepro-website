# MovePro DMV Movers - Full Website and Booking System

This project gives you a complete moving business website with an online quote calculator and backend booking API.

## What is included

- `frontend/` - static website for S3, CloudFront, or any web host
- `backend/` - Node.js Express API for quotes and bookings
- `scripts/create-dynamodb-table.sh` - creates the DynamoDB table
- `scripts/ec2-install-backend-dependencies.sh` - installs Node.js, npm, PM2 on Amazon Linux 2023
- `Jenkinsfile` - deploys frontend to S3 and backend to EC2 by SSH
- `docs/MovePro-Website-Deployment-Guide.pdf` - walkthrough guide

## Architecture

Customer browser -> S3/CloudFront frontend -> EC2 Node.js API -> DynamoDB booking table

## Local backend test

```bash
cd backend
cp .env.example .env
npm install
npm start
curl http://localhost:5000/api/health
```

## Create DynamoDB table

```bash
cd scripts
chmod +x create-dynamodb-table.sh
AWS_REGION=us-east-1 BOOKINGS_TABLE=MoveProBookings ./create-dynamodb-table.sh
```

## Deploy frontend manually

Update `frontend/app.js`:

```js
const API_BASE_URL = "http://YOUR_BACKEND_PUBLIC_IP:5000";
```

Then upload:

```bash
cd frontend
chmod +x deploy-frontend.sh
./deploy-frontend.sh YOUR_S3_BUCKET_NAME
```

## Backend EC2 setup

On the backend EC2 instance:

```bash
chmod +x scripts/ec2-install-backend-dependencies.sh
./scripts/ec2-install-backend-dependencies.sh
```

Then copy backend files to:

```bash
/home/ec2-user/movepro-website/backend
```

Create `.env` from `.env.example`, then:

```bash
cd /home/ec2-user/movepro-website/backend
chmod +x deploy-backend.sh
./deploy-backend.sh
```

## Security group ports

Backend EC2 inbound:

- SSH 22 from your IP only
- TCP 5000 from your frontend domain or temporarily your IP for testing
- Later: put API behind Nginx/ALB/HTTPS and avoid public 5000 exposure

## Jenkins credential names expected

- `backend-ec2-key` - SSH Username with private key for EC2 deployment
- AWS credential must be configured on Jenkins instance using IAM role or Jenkins AWS credentials plugin

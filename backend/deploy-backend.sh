#!/bin/bash
set -euo pipefail

APP_DIR="/home/ec2-user/movepro-website/backend"
APP_NAME="movepro-booking-api"

echo "Deploying backend from $APP_DIR"
cd "$APP_DIR"

npm install --omit=dev

if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

pm2 start ecosystem.config.js || pm2 restart "$APP_NAME"
pm2 save

echo "Backend deployed. Test: curl http://localhost:5000/api/health"

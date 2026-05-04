#!/bin/bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: ./deploy-frontend.sh YOUR_S3_BUCKET_NAME"
  exit 1
fi

BUCKET="$1"
aws s3 sync . "s3://$BUCKET" --delete

echo "Frontend uploaded to s3://$BUCKET"

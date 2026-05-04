#!/bin/bash
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
TABLE="${BOOKINGS_TABLE:-MoveProBookings}"

echo "Creating DynamoDB table: $TABLE in $REGION"

aws dynamodb create-table \
  --region "$REGION" \
  --table-name "$TABLE" \
  --attribute-definitions \
    AttributeName=bookingId,AttributeType=S \
  --key-schema \
    AttributeName=bookingId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Project,Value=MovePro Key=Environment,Value=dev || true

echo "Waiting for table to become ACTIVE..."
aws dynamodb wait table-exists --region "$REGION" --table-name "$TABLE"
echo "Done. Table ready: $TABLE"

#!/bin/bash
set -e

PROJECT="edcube-8fe7d"
REGION="us-west1"
SERVICE="edcube-backend"
IMAGE="gcr.io/$PROJECT/$SERVICE"

echo "=== Building backend Docker image ==="
docker build -t $IMAGE ./backend

echo "=== Pushing image to GCR ==="
docker push $IMAGE

echo "=== Deploying to Cloud Run ==="
gcloud run deploy $SERVICE \
  --image $IMAGE \
  --region $REGION \
  --project $PROJECT

echo "=== Building frontend ==="
cd frontend
npm run build

echo "=== Deploying frontend to Firebase ==="
firebase deploy --only hosting

echo "=== Done! ==="

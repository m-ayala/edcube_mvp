#!/bin/bash
set -e

PROJECT="edcubeai-fdba7"
ACCOUNT="manaswini.ayala@gmail.com"
REGION="us-west1"
SERVICE="edcube-backend"
IMAGE="$REGION-docker.pkg.dev/$PROJECT/edcube/$SERVICE"

# Backend config. Secrets live in Secret Manager in $PROJECT; plain values here.
SECRETS="OPENAI_API_KEY=OPENAI_API_KEY:latest,GOOGLE_API_KEY=GOOGLE_API_KEY:latest,YOUTUBE_API_KEY=YOUTUBE_API_KEY:latest,GOOGLE_CSE_ID=GOOGLE_CSE_ID:latest,SYNOPSIS_DRIVE_FOLDER_ID=SYNOPSIS_DRIVE_FOLDER_ID:latest,BROWSERBASE_API_KEY=BROWSERBASE_API_KEY:latest"
ENV_VARS="FIRESTORE_DATABASE=default,STORAGE_BUCKET=$PROJECT.firebasestorage.app"

echo "=== Building backend image (Cloud Build) ==="
gcloud builds submit ./backend --tag $IMAGE --project $PROJECT --account $ACCOUNT

echo "=== Deploying to Cloud Run ==="
gcloud run deploy $SERVICE \
  --image $IMAGE \
  --region $REGION \
  --project $PROJECT \
  --account $ACCOUNT \
  --set-secrets "$SECRETS" \
  --set-env-vars "$ENV_VARS" \
  --memory 1Gi --cpu 1 --timeout 300 --concurrency 80 --max-instances 3 --cpu-boost \
  --no-invoker-iam-check

echo "=== Building frontend ==="
cd frontend
npm run build

echo "=== Deploying frontend to Firebase ==="
firebase deploy --only hosting --project $PROJECT --account $ACCOUNT

echo "=== Done! ==="

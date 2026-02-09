#!/bin/bash
# SLKnight Cloud Run Deployment Script
# Usage: ./deploy.sh

set -e

echo "Deploying SLKnight to Google Cloud Run..."

# Check for gcloud CLI
if ! command -v gcloud &> /dev/null; then
    echo "gcloud CLI not found. Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Get project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo "No GCP project set. Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "Project: $PROJECT_ID"

# Check for GEMINI_API_KEY (required)
if [ -z "$GEMINI_API_KEY" ]; then
    echo "ERROR: GEMINI_API_KEY is required."
    echo "Set it with: export GEMINI_API_KEY=your-key-here"
    exit 1
fi

# Check for MAPBOX_TOKEN (optional but recommended)
MAPBOX_ENV=""
if [ -n "$MAPBOX_TOKEN" ]; then
    MAPBOX_ENV=",NEXT_PUBLIC_MAPBOX_TOKEN=$MAPBOX_TOKEN"
    echo "MAPBOX_TOKEN: set"
else
    echo "Warning: MAPBOX_TOKEN not set. Opportunity map will be disabled."
fi

REGION="${CLOUD_RUN_REGION:-us-central1}"

# Build and push using Cloud Build
echo "Building container..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/slknight .

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy slknight \
    --image gcr.io/$PROJECT_ID/slknight \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 3 \
    --set-env-vars "NODE_ENV=production,GOOGLE_AI_API_KEY=$GEMINI_API_KEY,DEMO_MODE_ENABLED=true${MAPBOX_ENV}"

# Get the deployed URL
URL=$(gcloud run services describe slknight --region $REGION --format 'value(status.url)')

echo ""
echo "================================================"
echo "  Deployment complete!"
echo "  Live URL: $URL"
echo "================================================"
echo ""
echo "Post-deploy verification:"
echo "  curl $URL/api/orchestrator/health"
echo ""
echo "Share this URL with judges!"

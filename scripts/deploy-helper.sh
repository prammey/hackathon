#!/bin/zsh
# Deploys the Prism helper to Cloud Run (needs: gcloud signed in, project owner). Usage: scripts/deploy-helper.sh
set -e
cd "$(dirname "$0")/.."
P="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
rm -rf helper/demo && mkdir -p helper/demo
cp -R fixtures/index.html fixtures/cluttered-info fixtures/canvas-shop fixtures/benefits-form fixtures/dynamic-app fixtures/image-text fixtures/non-english helper/demo/
cd helper
gcloud run deploy prism-helper --source . --project="$P" --region=us-central1 \
  --service-account="prism-helper@$P.iam.gserviceaccount.com" \
  --build-service-account="projects/$P/serviceAccounts/prism-builder@$P.iam.gserviceaccount.com" \
  --allow-unauthenticated --max-instances=2 --min-instances=0 --concurrency=20 --timeout=90 --memory=512Mi --cpu=1 \
  --set-env-vars="PRISM_MODE=hosted,GOOGLE_CLOUD_PROJECT=$P,GOOGLE_CLOUD_LOCATION=global" --quiet

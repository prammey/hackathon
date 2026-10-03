#!/bin/zsh
# Starts the Prism helper on this computer (http://127.0.0.1:8787) using your Google sign-in.
cd "$(dirname "$0")/../helper" || exit 1
export GOOGLE_CLOUD_PROJECT="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
export GOOGLE_CLOUD_LOCATION="${GOOGLE_CLOUD_LOCATION:-global}"
exec .venv/bin/uvicorn prism_helper.app:app --host 127.0.0.1 --port 8787

#!/usr/bin/env bash
# push-to-github.sh — minimal helper to create a repo and push
# USAGE:
# 1) Make executable: chmod +x push-to-github.sh
# 2) Edit the variables below: GITHUB_USER and REPO_NAME
# 3) Run: ./push-to-github.sh

set -euo pipefail

GITHUB_USER="YOUR_GITHUB_USERNAME"
REPO_NAME="barber-coach-prototype"
REMOTE_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"

if [ "$GITHUB_USER" = "YOUR_GITHUB_USERNAME" ]; then
  echo "Please edit push-to-github.sh and set GITHUB_USER and REPO_NAME." >&2
  exit 1
fi

echo "Initializing git repository (if none)..."
if [ ! -d .git ]; then
  git init
fi

git add .
git commit -m "Initial prototype" || echo "No changes to commit"

echo "Adding remote ${REMOTE_URL} and pushing to main..."
git branch -M main || true
git remote remove origin 2>/dev/null || true
git remote add origin "${REMOTE_URL}"
git push -u origin main

echo "Done. Visit https://github.com/${GITHUB_USER}/${REPO_NAME} to enable Pages or adjust settings."

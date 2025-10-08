#!/usr/bin/env bash
# Quick smoke test for the deployed site. Usage: ./scripts/check-site.sh
set -euo pipefail
BASE_URL=${1:-https://apmorey93.github.io/mstack}

echo "Checking $BASE_URL"
HTTP1=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
HTTP2=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/evidence.html")

if [ "$HTTP1" -ne 200 ]; then
  echo "Index returned HTTP $HTTP1"
  exit 2
fi
if [ "$HTTP2" -ne 200 ]; then
  echo "Evidence returned HTTP $HTTP2"
  exit 3
fi

echo "Both pages returned 200 OK"

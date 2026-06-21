#!/bin/sh
set -e

echo "==> [1/3] Checking environment..."
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set."
  exit 1
fi

echo "==> [2/3] Syncing database schema..."
# รันการ sync schema
prisma db push --url "$DATABASE_URL"

echo "==> [3/3] Starting AI Native App..."
exec node server.js

#!/bin/bash
# Drops and recreates the local nodeira database, then re-applies the schema.
# Useful during development when you need a clean slate.
#
# Requires: docker running with container named "postgres"

set -e

echo "Dropping nodeira database..."
docker exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS nodeira;"

echo "Recreating nodeira database..."
docker exec postgres psql -U postgres -c "CREATE DATABASE nodeira;"

echo "Applying schema..."
(cd "$(dirname "$0")/../apps/api" && pnpm exec prisma migrate deploy)

echo "Done. nodeira database is clean and up to date."

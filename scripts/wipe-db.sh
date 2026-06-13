#!/bin/bash
# Drops and recreates the local nodeira database, then re-applies the schema.
# Useful during development when you need a clean slate.
#
# Requires: docker running with container named "nodeira-postgres"

set -e

echo "Terminating active connections to nodeira..."
docker exec nodeira-postgres psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'nodeira' AND pid <> pg_backend_pid();"

echo "Dropping nodeira database..."
docker exec nodeira-postgres psql -U postgres -c "DROP DATABASE IF EXISTS nodeira;"

echo "Recreating nodeira database..."
docker exec nodeira-postgres psql -U postgres -c "CREATE DATABASE nodeira;"

echo "Applying schema..."
(cd "$(dirname "$0")/../apps/api" && pnpm exec prisma migrate deploy)

echo "Done. nodeira database is clean and up to date."

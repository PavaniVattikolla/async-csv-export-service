#!/usr/bin/env bash
# seeds the database with 10M rows by copying the SQL into the db container and running it.
set -euo pipefail
CONTAINER_NAME="$(docker ps --filter "name=async-csv-export-service-db-1" --format "{{.Names}}")"
if [ -z "$CONTAINER_NAME" ]; then
  echo "Database container not running. Start the compose stack first."
  exit 1
fi

echo "Copying seed_10m.sql into container..."
docker cp seeds/seed_10m.sql "$CONTAINER_NAME":/seed_10m.sql

echo "Executing seed (this may run for many minutes) ..."
docker exec -it "$CONTAINER_NAME" psql -U exporter -d exports_db -v ON_ERROR_STOP=1 -f /seed_10m.sql

echo "Seeding completed."

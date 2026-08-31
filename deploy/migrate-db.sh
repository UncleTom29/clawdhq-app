#!/usr/bin/env bash
# One-time data migration: dump the Render Postgres and restore it into the
# EC2 Postgres container.
#
# Usage:
#   RENDER_DATABASE_URL='postgresql://...' ./deploy/migrate-db.sh ubuntu@1.2.3.4 [-i key.pem]
#
# Run AFTER the stack is up (deploy.sh) and BEFORE pointing the web app at the
# new API. Requires pg_dump locally (or run it on the EC2 host).
set -euo pipefail

HOST="${1:?usage: RENDER_DATABASE_URL=... ./deploy/migrate-db.sh user@host [ssh args...]}"
shift
SSH_ARGS=("$@")
: "${RENDER_DATABASE_URL:?set RENDER_DATABASE_URL to the old Render postgres connection string}"

DUMP=/tmp/clawdfeed-render-$(date +%Y%m%d%H%M%S).dump

echo "==> Dumping Render database"
pg_dump --no-owner --no-privileges --format=custom "$RENDER_DATABASE_URL" -f "$DUMP"

echo "==> Copying dump to server"
scp "${SSH_ARGS[@]}" "$DUMP" "$HOST:/tmp/clawdfeed.dump"

echo "==> Restoring into EC2 postgres container"
ssh "${SSH_ARGS[@]}" "$HOST" "docker compose -f /opt/clawdfeed/deploy/docker-compose.yml cp /tmp/clawdfeed.dump postgres:/tmp/clawdfeed.dump && docker compose -f /opt/clawdfeed/deploy/docker-compose.yml exec -T postgres pg_restore --no-owner --no-privileges --clean --if-exists -U clawdfeed -d clawdfeed /tmp/clawdfeed.dump"

echo "==> Row counts"
ssh "${SSH_ARGS[@]}" "$HOST" "docker compose -f /opt/clawdfeed/deploy/docker-compose.yml exec -T postgres psql -U clawdfeed -d clawdfeed -c 'SELECT (SELECT count(*) FROM agents) agents, (SELECT count(*) FROM posts) posts, (SELECT count(*) FROM tips) tips;'"

rm -f "$DUMP"
echo "==> Done"

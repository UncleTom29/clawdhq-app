#!/usr/bin/env bash
# Deploy the ClawdHQ API + Postgres stack to an EC2 host.
#
# Usage:
#   ./deploy/deploy.sh ubuntu@1.2.3.4 [-i ~/.ssh/key.pem]
#   WITH_CADDY=1 ./deploy/deploy.sh ubuntu@1.2.3.4 [-i ~/.ssh/key.pem]
#
# By default this does NOT start the bundled Caddy reverse proxy — the API is
# published to 127.0.0.1:4100 only, so it's safe on a host that already runs
# its own nginx/Caddy/ALB in front of other projects (point that proxy at
# 127.0.0.1:4100). Set WITH_CADDY=1 only on a host with ports 80/443 free.
#
# Prerequisites on the EC2 host: Docker Engine + compose plugin (RUNBOOK.md §2),
# and deploy/.env created from deploy/.env.production.example (§3).
set -euo pipefail

HOST="${1:?usage: ./deploy/deploy.sh user@host [ssh args...]}"
shift
SSH_ARGS=("$@")
REMOTE_DIR=/opt/clawdfeed # internal server path only, kept from pre-rename infra — see docker-compose.yml
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROFILE_FLAG=""
UP_SERVICES="api"
if [ "${WITH_CADDY:-0}" = "1" ]; then
  PROFILE_FLAG="--profile caddy"
  UP_SERVICES="api caddy"
fi

echo "==> Syncing sources to ${HOST}:${REMOTE_DIR}"
ssh "${SSH_ARGS[@]}" "$HOST" "sudo mkdir -p ${REMOTE_DIR} && sudo chown \$(whoami) ${REMOTE_DIR}"
rsync -az --delete -e "ssh ${SSH_ARGS[*]:-}" \
  --exclude node_modules --exclude dist --exclude .env --exclude '.env.*' \
  "${REPO_ROOT}/api" "$HOST:${REMOTE_DIR}/"
rsync -az -e "ssh ${SSH_ARGS[*]:-}" \
  --exclude .env \
  "${REPO_ROOT}/deploy" "$HOST:${REMOTE_DIR}/"

echo "==> Checking server env file"
ssh "${SSH_ARGS[@]}" "$HOST" "test -f ${REMOTE_DIR}/deploy/.env" || {
  echo "ERROR: ${REMOTE_DIR}/deploy/.env missing on the server."
  echo "Create it from deploy/.env.production.example first (RUNBOOK.md §3)."
  exit 1
}

echo "==> Building and starting containers"
# `docker compose run` does not rebuild on source changes by default — it
# silently reuses whatever image already exists, which let stale schema.prisma
# changes skip the migration once already. Always --build here.
ssh "${SSH_ARGS[@]}" "$HOST" "cd ${REMOTE_DIR}/deploy && docker compose build api migrate && docker compose up -d postgres && docker compose run --rm --build migrate && docker compose ${PROFILE_FLAG} up -d ${UP_SERVICES}"

echo "==> Waiting for health check"
sleep 5
ssh "${SSH_ARGS[@]}" "$HOST" "curl -sf http://127.0.0.1:4100/health"
echo
echo "==> Done. If a host reverse proxy is configured for API_DOMAIN, verify externally: curl https://\$API_DOMAIN/health"

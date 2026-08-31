# ClawdHQ — AWS EC2 Deployment Runbook

The backend (Express API) and Postgres both run on a single EC2 instance via
Docker Compose; Caddy terminates TLS with automatic Let's Encrypt certificates.
Render is fully retired.

Stack layout on the instance (`/opt/clawdhq`):

```
/opt/clawdhq
├── api/        # backend sources (rsynced by deploy.sh, built into a Docker image)
├── deploy/     # docker-compose.yml, Caddyfile, .env (secrets), scripts
└── backups/    # nightly pg_dump output
```

## 1. Provision the EC2 instance

- Recommended: Ubuntu 24.04 LTS, `t3.small` or larger (Prisma + Node build wants ≥2 GB RAM; add swap on `t3.micro`).
- Storage: ≥20 GB gp3.
- **Security group inbound rules**: TCP 22 (your IP), TCP 80, TCP 443. Nothing else — Postgres stays on the internal Docker network.
- Allocate and associate an **Elastic IP** so the DNS record survives restarts.

## 2. Install Docker (once, on the instance)

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # then reconnect the SSH session
docker compose version
```

## 3. Server configuration

```bash
sudo mkdir -p /opt/clawdhq && sudo chown $USER /opt/clawdhq
```

Create `/opt/clawdhq/deploy/.env` from `.env.production.example` (this repo)
and fill every value:

- `API_DOMAIN` — e.g. `api.clawdhq.xyz`
- `POSTGRES_PASSWORD` — fresh random secret (`openssl rand -hex 24`)
- `ARC_ADMIN_PRIVATE_KEY` — **new** key (see §8), funded with Arc USDC from faucet.circle.com
- `AGENT_REGISTRY_ADDRESS` — from `contracts` deploy (`npm run deploy:arc`)
- `CIRCLE_API_KEY` / `CIRCLE_ENTITY_SECRET` — Circle developer console (testnet)
- `CIRCLE_WALLET_SET_ID` / `CIRCLE_TREASURY_WALLET_ID` / `CIRCLE_TREASURY_WALLET_ADDRESS` —
  leave blank on first boot; the API logs the created ids, then pin them here and restart
- `TWITTER_BEARER_TOKEN`, `WEB_BASE_URL`, `PRO_MONTHLY_PRICE_USDC`

## 4. DNS

Create an **A record** for `API_DOMAIN` → the Elastic IP. Caddy obtains the TLS
certificate automatically on first request (ports 80/443 must be reachable).

## 5. Deploy

From this repo on your machine:

```bash
./deploy/deploy.sh ubuntu@<elastic-ip> -i ~/.ssh/<key>.pem
```

The script rsyncs `api/` + `deploy/`, builds the image, starts Postgres, runs
`prisma db push` (one-shot `migrate` service), then starts the API and Caddy.

Verify:

```bash
curl https://api.clawdhq.xyz/health
# {"status":"ok","service":"clawdhq-api", ...}
```

## 6. Migrate data off Render (one-time)

```bash
RENDER_DATABASE_URL='postgresql://clawdhq:...@dpg-....oregon-postgres.render.com/clawdhq' \
  ./deploy/migrate-db.sh ubuntu@<elastic-ip> -i ~/.ssh/<key>.pem
```

Then suspend/delete the Render service and database (after confirming row counts).

## 7. Backups

```bash
ssh ubuntu@<elastic-ip> 'crontab -l 2>/dev/null; echo "0 3 * * * /opt/clawdhq/deploy/backup.sh >> /opt/clawdhq/backups/backup.log 2>&1"' | ssh ubuntu@<elastic-ip> crontab -
```

Nightly `pg_dump`s land in `/opt/clawdhq/backups`, pruned after 14 days.
Consider syncing that directory to S3.

## 8. Secret rotation checklist (IMPORTANT)

The old repo committed live secrets in `api/.env`, `web/.env`, `contracts/.env`.
During cutover:

- [ ] Generate a **new** Arc admin key; never reuse the committed Avalanche one
- [ ] Rotate the Twitter bearer token in the X developer portal
- [ ] Treat the old Render `DATABASE_URL` as compromised; it dies with the Render DB
- [ ] Keep the new secrets only in `/opt/clawdhq/deploy/.env` (never commit)

## 9. Point the web app at EC2

In Cloudflare Pages project settings (and `web/.env` for local dev):

```
NEXT_PUBLIC_API_URL=https://api.clawdhq.xyz/api/v1
NEXT_PUBLIC_SOCKET_URL=https://api.clawdhq.xyz
NEXT_PUBLIC_WS_URL=wss://api.clawdhq.xyz
```

Redeploy the web app.

## 10. Operations

```bash
# logs
ssh ubuntu@<ip> 'docker compose -f /opt/clawdhq/deploy/docker-compose.yml logs -f api'
# restart API only
ssh ubuntu@<ip> 'docker compose -f /opt/clawdhq/deploy/docker-compose.yml restart api'
# apply schema changes after a new deploy
ssh ubuntu@<ip> 'cd /opt/clawdhq/deploy && docker compose run --rm migrate'
# psql shell
ssh ubuntu@<ip> 'docker compose -f /opt/clawdhq/deploy/docker-compose.yml exec postgres psql -U clawdhq clawdhq'
```

Redeploying code = rerun `./deploy/deploy.sh ...` (idempotent).

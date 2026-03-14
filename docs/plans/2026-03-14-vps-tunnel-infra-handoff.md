# ColdGuard VPS Tunnel Infra Handoff

**Date:** 2026-03-14

## Purpose

This document defines the contract for the separate private infrastructure repository that will deploy `coldguard-web` to a VPS behind Cloudflare Tunnel.

The goal is to keep:

- application build and image publishing in this repository;
- VPS host layout, Docker Compose, and Cloudflare Tunnel runtime in the private infra repository.

## Responsibility Split

This repository owns:

- `coldguard-web` application source;
- the production Docker image definition;
- GitHub Actions publishing to GHCR;
- app-level documentation and public route expectations.

The private infra repository owns:

- the VPS bootstrap instructions;
- the Docker Compose stack;
- `cloudflared` runtime wiring;
- deployment and rollback scripts;
- secret file locations and operator runbooks.

## Image Contract

Application image:

- `ghcr.io/kevin-nav/coldguard-web:latest`
- `ghcr.io/kevin-nav/coldguard-web:sha-<full-commit-sha>`

The GitHub Actions workflow in this repo publishes both tags on pushes to `main` that touch `coldguard-web/**`.

Infra should prefer:

- `sha-<full-commit-sha>` for explicit, repeatable deployments;
- `latest` only for manual or low-risk environments.

The container listens on:

- internal port `3000`

## Current Runtime Environment

The current web app does **not** require any application-specific secret environment variables.

Runtime assumptions today:

- `NODE_ENV=production`
- `HOSTNAME=0.0.0.0`
- `PORT=3000`

If app secrets are introduced later, add them in the private infra repo and store the real values on the VPS, not in this repository.

## Public Contract

The deployed app must return `200` for:

- `/`
- `/privacy`
- `/terms`
- `/device/test-id?claim=test&v=1`
- `/.well-known/assetlinks.json`

The file `/.well-known/assetlinks.json` must remain publicly reachable without authentication because Android App Links verification depends on it.

## Required Docker Network Shape

The private infra stack should use a shared internal Docker network containing:

- `coldguard-web`
- `cloudflared`

Recommended service routing:

- public hostname `coldguard.org` -> `http://coldguard-web:3000`
- optional `www.coldguard.org` -> redirect at Cloudflare or second hostname to the same origin

## Secret Placement

Do **not** store deployment secrets in this repo.

Recommended placement:

- GitHub Actions publish credential:
  - use the repository `GITHUB_TOKEN` already available in Actions for GHCR publishing;
- VPS GHCR pull credential:
  - store on the VPS as a root-readable secret file;
- Cloudflare Tunnel token:
  - store on the VPS as a root-readable secret file;
- optional Cloudflare API token:
  - only needed if the infra repo automates tunnel or DNS creation.

Recommended VPS secret paths:

- `/opt/coldguard/secrets/ghcr_username`
- `/opt/coldguard/secrets/ghcr_pat`
- `/opt/coldguard/secrets/cloudflare_tunnel_token`

Recommended permissions:

- directory mode `0700`
- secret file mode `0600`
- owner `root:root`

## Recommended VPS Layout

Suggested layout on the VPS:

All paths in this section refer to the **remote VPS**, not a developer workstation.

```text
/opt/coldguard/
  infra/                  # checkout of the private infra repo
  env/
    stack.env             # non-secret deployment config
  secrets/
    ghcr_username
    ghcr_pat
    cloudflare_tunnel_token
```

`stack.env` should contain only non-secret values, for example:

```dotenv
GHCR_OWNER=kevin-nav
COLDGUARD_WEB_TAG=latest
COMPOSE_PROJECT_NAME=coldguard
```

## Private Infra Repo Files To Create First

The next agent should create these files first in the private infra repo:

- `compose.yaml`
- `env/stack.env.example`
- `scripts/deploy.sh`
- `README.md`

## Recommended Compose Shape

Example `compose.yaml`:

```yaml
services:
  coldguard-web:
    image: ghcr.io/${GHCR_OWNER}/coldguard-web:${COLDGUARD_WEB_TAG:-latest}
    restart: unless-stopped
    env_file:
      - ./env/web.env
    expose:
      - "3000"
    networks:
      - coldguard

  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command:
      - tunnel
      - --no-autoupdate
      - run
      - --token
      - ${CLOUDFLARE_TUNNEL_TOKEN}
    depends_on:
      - coldguard-web
    networks:
      - coldguard

networks:
  coldguard:
    driver: bridge
```

Notes:

- `CLOUDFLARE_TUNNEL_TOKEN` should be exported by the deploy script from the VPS secret file just before `docker compose up -d`.
- `env/web.env` can remain empty today because the app currently has no custom runtime env vars, but keep the file so future app config has a stable place to land.

## Deploy Script Contract

Recommended `scripts/deploy.sh` responsibilities:

1. Read non-secret config from `/opt/coldguard/env/stack.env`.
2. Read secrets from `/opt/coldguard/secrets/*`.
3. `docker login ghcr.io` using the VPS pull credential.
4. `docker compose pull`.
5. `docker compose up -d`.
6. Run a post-deploy HTTP smoke check against `http://127.0.0.1:<local-port>` or through the `coldguard-web` container network path.

Example shape:

```bash
#!/usr/bin/env bash
set -euo pipefail

set -a
source /opt/coldguard/env/stack.env
set +a

export CLOUDFLARE_TUNNEL_TOKEN="$(cat /opt/coldguard/secrets/cloudflare_tunnel_token)"
GHCR_USERNAME="$(cat /opt/coldguard/secrets/ghcr_username)"

docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin < /opt/coldguard/secrets/ghcr_pat
docker compose pull
docker compose up -d
docker compose ps
```

## VPS Bootstrap Instructions

Recommended baseline:

1. Provision an Ubuntu VPS.
2. Ensure outbound internet access is available.
3. Install Docker Engine and the Docker Compose plugin.
4. Create `/opt/coldguard/{infra,env,secrets}`.
5. Check out the private infra repo into `/opt/coldguard/infra`.
6. Create `/opt/coldguard/env/stack.env`.
7. Create the secret files in `/opt/coldguard/secrets`.
8. Run the deploy script from the infra repo.

The VPS does **not** need:

- inbound `80` or `443` from the public internet;
- a checkout of this application repository;
- a public DNS A record pointing at the VPS IP.

## Cloudflare Tunnel Setup

Use a **remotely managed** Cloudflare Tunnel for the simplest production setup.

Recommended setup steps:

1. In Cloudflare dashboard, create a new tunnel for production web traffic.
2. Choose the Docker environment when Cloudflare shows install instructions.
3. Copy the tunnel token from the generated `cloudflared` command and save only the token value.
4. Store that token in `/opt/coldguard/secrets/cloudflare_tunnel_token` on the VPS.
5. In the tunnel's public hostname settings, add:
   - `coldguard.org` -> `http://coldguard-web:3000`
6. Optionally add:
   - `www.coldguard.org` -> same service or redirect at Cloudflare.

This means:

- tunnel routing settings live in Cloudflare, not in the application repo;
- the only tunnel secret needed at runtime is the tunnel token on the VPS.

## DNS Expectations

The public site should resolve through Cloudflare Tunnel, not directly to the VPS IP.

Expected result:

- Cloudflare creates or manages a proxied DNS record pointing the hostname at `<tunnel-id>.cfargotunnel.com`;
- no direct public origin IP should be advertised for `coldguard.org`.

## GHCR Expectations

Default expectation:

- the GHCR package remains private unless you intentionally make it public.

If the package stays private:

- create a GitHub personal access token (classic) with at least `read:packages`;
- if the owner uses SSO, authorize the token for that org;
- store that PAT only on the VPS.

If the package is made public:

- GHCR pull credentials are optional.

## Deployment Readiness Checklist

Before production cutover, confirm:

- the GHCR image workflow has run successfully on `main`;
- the expected image tag exists in GHCR;
- the GHCR package visibility and access controls are correct;
- the VPS can run Docker and Docker Compose;
- the VPS can reach Cloudflare outbound;
- the VPS can reach GHCR outbound;
- the tunnel token is present on the VPS;
- the app routes above return `200`;
- `/.well-known/assetlinks.json` is publicly accessible through `https://coldguard.org/.well-known/assetlinks.json`.

## Residual Operational Requirements

- VPS needs outbound access only.
- VPS needs GHCR pull credentials unless the image is public.
- Cloudflare tunnel credentials must exist before deployment.
- GitHub Actions package publishing permissions must remain enabled in the app repo.

## Handoff To The Next Agent

The next agent implementing the private infra repo should start with:

- `docs/plans/2026-03-14-vps-tunnel-web-deployment-design.md`
- `docs/plans/2026-03-14-vps-tunnel-web-deployment-plan.md`
- `docs/plans/2026-03-14-vps-tunnel-infra-handoff.md`

Files they should create first in the private infra repo:

- `compose.yaml`
- `env/stack.env.example`
- `scripts/deploy.sh`
- `README.md`

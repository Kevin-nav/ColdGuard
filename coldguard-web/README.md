# ColdGuard Web

Docker-deployed Next.js app for `coldguard.org`.

## Deployment Model

This app builds a standalone Next.js production server image. This repository is responsible for:

- building the app
- publishing `ghcr.io/<github-owner>/coldguard-web`
- documenting the runtime contract for the separate private VPS and Cloudflare Tunnel infra repo

The private infra repo is responsible for:

- pulling the published image from GHCR
- running the container on the VPS
- exposing it through Cloudflare Tunnel

## Local Development

From `coldguard-web/`:

```bash
npm run dev
```

Open `http://localhost:3000`.

For a production-style local build:

```bash
npm run build
npm run start
```

## Docker Image

Build the production image from the repo root:

```bash
docker build -t coldguard-web:local coldguard-web
```

Run it locally:

```bash
docker run --rm -p 3000:3000 coldguard-web:local
```

The app listens on port `3000`.

## GHCR Publishing

GitHub Actions publishes the container image on pushes to `main` that touch `coldguard-web/**`.

Published tags:

- `ghcr.io/kevin-nav/coldguard-web:latest`
- `ghcr.io/kevin-nav/coldguard-web:sha-<full-commit-sha>`

Repository settings expectations:

- Actions must have permission to write packages.
- The resulting GHCR package should be visible to whichever environment or account needs to pull it.
- VPS deployment needs GHCR pull credentials if the package remains private.

## VPS Deployment Readiness

For the VPS, keep deployment configuration outside this repo:

- tunnel routing settings live in the Cloudflare dashboard;
- tunnel token lives on the VPS as a secret file;
- GHCR pull credentials live on the VPS as secret files if the package is private;
- the private infra repo owns Docker Compose, deploy scripts, and host layout.

Use the handoff document for the exact contract and bootstrap steps:

- `../docs/plans/2026-03-14-vps-tunnel-infra-handoff.md`

Current app runtime note:

- `coldguard-web` currently has no app-specific secret environment variables beyond standard container settings like `PORT` and `HOSTNAME`.
- the VPS instructions in the handoff doc refer to a separate remote host; local Docker use in this repo is only for image verification.

## Device QR Flow

Printed device QR codes should always encode the HTTPS enrollment link:

```text
https://coldguard.org/device/<deviceId>?claim=<bootstrapToken>&v=1
```

That one URL supports:

- Android App Links into the ColdGuard app when installed
- browser fallback to the website landing page when the app is not installed
- copy/paste into the app enrollment screen when needed

## App Link Verification

The Android Digital Asset Links file is served from:

```text
/.well-known/assetlinks.json
```

If the Android signing certificate changes, update `public/.well-known/assetlinks.json` with the new SHA-256 fingerprint before deploying.

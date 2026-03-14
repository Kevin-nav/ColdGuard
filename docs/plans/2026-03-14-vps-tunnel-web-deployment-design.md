# VPS Tunnel Web Deployment Design

**Date:** 2026-03-14

**Scope**

Move `coldguard-web` off Cloudflare Workers and deploy it to a VPS as a Dockerized Next.js app, exposed through Cloudflare Tunnel instead of a static public VPS IP. Keep application code in this repository and keep VPS/tunnel orchestration in a separate private infrastructure repository.

**Goals**

- Deploy `coldguard.org` without relying on Cloudflare Workers.
- Avoid exposing the VPS through a fixed public IP or requiring inbound `80/443`.
- Keep source code off the VPS.
- Publish prebuilt images from GitHub Actions and let the VPS pull only container images.
- Preserve support for public HTTPS routes required by Android App Links and Google review:
  - `/`
  - `/privacy`
  - `/terms`
  - `/device/[id]`
  - `/.well-known/assetlinks.json`

**Approved Constraints**

- Do not use Cloudflare Pages or Workers for the production web app.
- Do not pull repository source code onto the VPS.
- Keep deployment-specific infrastructure files out of this repo when possible.
- Use GitHub secrets for runtime/deployment credentials, including Cloudflare Tunnel credentials.

## Architecture

### 1. Repository Split

This repository remains the application repository. It should own:

- the `coldguard-web` source code;
- a production Docker image definition for the Next.js app;
- GitHub Actions that build and publish the container image to GitHub Container Registry (GHCR).

A separate private infrastructure repository should own:

- the Docker Compose stack for the VPS;
- the `cloudflared` configuration;
- the deploy/update script that pulls a new GHCR image and restarts containers;
- any VPS-specific operational notes.

This split keeps the app repo clean and avoids coupling application changes to one specific host layout.

### 2. Delivery Flow

The production delivery path should be:

1. Push to `main` in this repo.
2. GitHub Actions builds a production Docker image for `coldguard-web`.
3. GitHub Actions pushes a versioned image to GHCR.
4. The VPS pulls the new image from GHCR.
5. Docker Compose restarts the app container.
6. `cloudflared` routes `coldguard.org` traffic to the app container over the internal Docker network.

The VPS never needs a source checkout of this repo.

### 3. Domain and Tunnel

Cloudflare remains the DNS and edge provider for the domain, but not the application runtime.

Recommended tunnel shape:

- `coldguard.org` -> `http://coldguard-web:3000`
- optionally `www.coldguard.org` -> redirect or same service

`cloudflared` runs on the VPS as a container with tunnel credentials supplied at deploy/runtime. The VPS only needs outbound internet access for:

- Cloudflare Tunnel
- GHCR image pulls

### 4. Application Runtime

The app should run as a standard Next.js standalone Node server inside Docker. This avoids the Cloudflare Worker size/runtime constraints and matches the app’s current architecture better.

The container should:

- build from the `coldguard-web` app;
- run the production standalone server;
- expose internal port `3000`;
- serve all public pages and files needed for app links and Google review.

### 5. Decommissioning the Cloudflare Worker Path

The current repo still contains Cloudflare Worker-specific scripts and workflow artifacts from the attempted migration. The implementation should remove or replace those so the repo has one clear deployment story.

That includes:

- removing the Cloudflare worker deployment workflow;
- removing worker-specific build scripts that are no longer needed;
- documenting the new Docker/GHCR deployment path clearly.

## Verification

Application repo verification:

- local production Docker build succeeds;
- local container serves the expected routes;
- `assetlinks.json` is reachable from the running container.

Infrastructure repo verification:

- VPS can authenticate to GHCR and pull the image;
- tunnel routes `coldguard.org` to the app container;
- HTTPS endpoints load correctly through the public domain.

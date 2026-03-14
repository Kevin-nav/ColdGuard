# VPS Tunnel Web Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the failed Cloudflare Workers deployment path with a Docker-based VPS deployment where this repo publishes a prebuilt `coldguard-web` image to GHCR and a separate private infra repo runs the image behind Cloudflare Tunnel.

**Architecture:** Keep application concerns in this repo and move host/tunnel orchestration to a separate private infrastructure repo. Build a standalone Next.js production container here, publish it from GitHub Actions, and document the exact VPS-side expectations so another agent can create the infra repo without needing app-context archaeology.

**Tech Stack:** Next.js 16 standalone server, Docker multi-stage builds, GitHub Actions, GitHub Container Registry, Cloudflare Tunnel, Docker Compose

---

### Task 1: Remove the Cloudflare Worker deployment path from the app repo

**Files:**
- Modify: `coldguard-web/package.json`
- Modify: `coldguard-web/README.md`
- Delete: `.github/workflows/coldguard-web-deploy.yml`
- Review: `coldguard-web/next.config.ts`
- Review: `coldguard-web/open-next.config.ts`
- Review: `coldguard-web/wrangler.jsonc`

**Step 1: Remove worker-specific scripts**

- Delete scripts such as `build:worker`, `deploy`, `preview`, `upload`, and `cf-typegen` if they are only used for the abandoned Cloudflare Worker path.
- Keep `build`, `dev`, `start`, and `lint`.

**Step 2: Remove worker deployment automation**

- Delete the Cloudflare Worker GitHub Actions workflow so the repo no longer advertises the wrong deployment story.

**Step 3: Decide whether to delete or archive worker config files**

- If they are now unused, remove `open-next.config.ts` and `wrangler.jsonc`.
- If you keep them temporarily, mark them clearly as deprecated and not part of the supported deployment path.

**Step 4: Run local checks**

Run: `npm run build`
Expected: PASS

### Task 2: Add a production Docker image for `coldguard-web`

**Files:**
- Create: `coldguard-web/Dockerfile`
- Create: `coldguard-web/.dockerignore`
- Modify: `coldguard-web/package.json`
- Modify: `coldguard-web/README.md`

**Step 1: Create a multi-stage Dockerfile**

- Builder stage should install dependencies and run `npm run build`.
- Runtime stage should copy the standalone Next output and run the Node server.
- Expose port `3000`.

**Step 2: Add a Docker ignore file**

- Exclude `.next`, `node_modules`, local dev artifacts, and unrelated repo content.

**Step 3: Add optional convenience scripts only if they help**

- For example, `docker:build` or `docker:run` if useful.
- Do not add unnecessary local tooling.

**Step 4: Verify the image locally**

Run: `docker build -t coldguard-web:local coldguard-web`
Expected: PASS

### Task 3: Add GHCR publishing from this repo

**Files:**
- Create: `.github/workflows/coldguard-web-image.yml`
- Modify: `coldguard-web/README.md`

**Step 1: Create a GitHub Actions image workflow**

- Trigger on `main` pushes affecting `coldguard-web/**`.
- Log in to GHCR using `GITHUB_TOKEN`.
- Build and push a versioned image and a `latest` tag.

**Step 2: Document required GitHub settings**

- Mention package visibility expectations and any required permissions.

**Step 3: Verify workflow assumptions**

- Confirm the image name format and tags are predictable for the infra repo.

### Task 4: Document the private infra repo contract

**Files:**
- Create: `docs/plans/2026-03-14-vps-tunnel-infra-handoff.md`
- Modify: `coldguard-web/README.md`

**Step 1: Write a handoff document for the infra repo**

- Include the expected GHCR image name.
- Include required runtime env vars.
- Include the required Cloudflare Tunnel behavior.
- Include the expected Docker network shape:
  - `coldguard-web`
  - `cloudflared`

**Step 2: Document DNS and tunnel expectations**

- `coldguard.org` should map through Cloudflare Tunnel, not directly to a VPS IP.
- `/.well-known/assetlinks.json` must remain public.

### Task 5: Verify the app’s public contract locally

**Files:**
- Verify: `coldguard-web/public/.well-known/assetlinks.json`
- Verify: `coldguard-web/src/app/privacy/page.tsx`
- Verify: `coldguard-web/src/app/terms/page.tsx`
- Verify: `coldguard-web/src/app/device/[id]/page.tsx`

**Step 1: Run the production app locally**

Run: local Docker container or local production server
Expected:
- `/` returns `200`
- `/privacy` returns `200`
- `/terms` returns `200`
- `/device/test-id?claim=test&v=1` returns `200`
- `/.well-known/assetlinks.json` returns `200`

**Step 2: Record residual operational requirements**

- VPS needs outbound access only.
- VPS needs GHCR pull credentials.
- GitHub secrets and Cloudflare tunnel credentials must exist before deployment.

### Task 6: Hand off the infra implementation cleanly

**Files:**
- Reference only: `docs/plans/2026-03-14-vps-tunnel-web-deployment-design.md`
- Reference only: `docs/plans/2026-03-14-vps-tunnel-web-deployment-plan.md`
- Reference only: `docs/plans/2026-03-14-vps-tunnel-infra-handoff.md`

**Step 1: Summarize the split of responsibilities**

- This repo: image build and app runtime
- Private infra repo: VPS deployment and Cloudflare Tunnel

**Step 2: Identify secrets**

- `GITHUB_TOKEN` or package-publish permissions for GHCR
- app runtime env vars
- Cloudflare tunnel token or credentials in the infra repo / deploy environment

**Step 3: Hand to the next agent**

- Point them to the three docs above and the app files they must touch first.

# ColdGuard Web Workers Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate `coldguard-web` from static export deployment on Cloudflare Pages to a Workers-compatible Next.js deployment and add a real `/device/[id]` landing flow for QR enrollment fallback.

**Architecture:** Replace `output: "export"` with a Cloudflare Workers-compatible Next.js setup using the current Cloudflare-supported OpenNext path. Keep the existing marketing pages intact, add a server-capable device landing route that preserves `claim` and `v`, and update deployment configuration so `coldguard.org` can serve both static marketing pages and request-aware device routes from the same app.

**Tech Stack:** Next.js App Router, Cloudflare Workers, Wrangler, OpenNext for Cloudflare, Tailwind CSS

---

### Task 1: Migrate `coldguard-web` to Cloudflare Workers deployment

**Files:**
- Modify: `coldguard-web/package.json`
- Modify: `coldguard-web/next.config.ts`
- Create or modify: `coldguard-web/wrangler.jsonc`
- Create or modify: `coldguard-web/open-next.config.ts` if needed by the migration tool

**Step 1: Replace static-export deployment settings**

- Remove `output: "export"` from `coldguard-web/next.config.ts`.
- Keep image handling compatible with Cloudflare deployment.

**Step 2: Add Workers deployment configuration**

- Configure Wrangler for a Next.js Worker deployment.
- Use a current Cloudflare-supported Workers setup rather than the old Pages static deploy.

**Step 3: Update package scripts**

- Replace the current Pages deploy command with a Workers deploy command.
- Add a local Workers dev command if the generated config supports it.

**Step 4: Verify the app still builds**

Run: `npm run build`
Expected: PASS with a Next.js build suitable for Workers deployment.

### Task 2: Add the device QR landing route

**Files:**
- Create: `coldguard-web/src/app/device/[id]/page.tsx`
- Modify: `coldguard-web/src/app/layout.tsx`
- Modify: `coldguard-web/src/app/globals.css`

**Step 1: Build a request-aware `/device/[id]` page**

- Read `params.id`, `searchParams.claim`, and `searchParams.v`.
- Validate that `claim` and `v` exist before presenting enrollment actions.

**Step 2: Add app handoff UX**

- Render a strong mobile-first landing page for device enrollment.
- Include:
  - device ID
  - open-in-app button using `coldguard://device/...`
  - copyable HTTPS enrollment link
  - explanation for supervisors and fallback behavior

**Step 3: Keep QR behavior consistent**

- Ensure the same HTTPS URL works for:
  - Android App Links when the app is installed
  - website fallback when the app is not installed or verification is incomplete

**Step 4: Verify route rendering**

Run: `npm run build`
Expected: PASS and the route compiles under the Workers-compatible setup.

### Task 3: Verify Cloudflare app-link support remains intact

**Files:**
- Verify: `coldguard-web/public/.well-known/assetlinks.json`
- Verify: `android/app/src/main/AndroidManifest.xml`

**Step 1: Keep Digital Asset Links file deployed through the web app**

- Confirm `/.well-known/assetlinks.json` remains part of the built output.

**Step 2: Verify Android app-link configuration still matches**

- Confirm the app package and fingerprint used in the site asset links file match the current Android build.

**Step 3: Smoke-test build artifacts**

Run: `npm run build`
Run: `Get-Content coldguard-web\\out\\.well-known\\assetlinks.json` or Workers-equivalent built asset inspection
Expected: file exists and contains the current package binding.

### Task 4: Update local deployment guidance

**Files:**
- Modify: `coldguard-web/README.md`

**Step 1: Replace static Pages instructions**

- Document local dev, build, and deploy commands for the Workers-based setup.
- Note that `/device/[id]` is now handled by the web app itself.

**Step 2: Note QR and fallback behavior**

- Document that printed device QR codes should always use the HTTPS enrollment link.

### Task 5: Final verification

**Files:**
- Verify working tree changes only touch intended web/app-link files

**Step 1: Build the web app**

Run: `npm run build`
Expected: PASS

**Step 2: Inspect generated config and route files**

Run: `git diff -- coldguard-web android/app/src/main/AndroidManifest.xml`
Expected: only deployment, route, and app-link changes

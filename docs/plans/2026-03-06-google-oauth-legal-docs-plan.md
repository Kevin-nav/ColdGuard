# Google OAuth Legal Docs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the ColdGuard public legal pages and crawler signals clear enough for Google OAuth branding verification.

**Architecture:** Keep the existing static-export Next site, but upgrade the policy content, add route-level metadata, and publish explicit metadata routes for `robots.txt` and `sitemap.xml`. Verification relies on generating clear HTML artifacts that Cloudflare Pages can serve directly.

**Tech Stack:** Next.js app router, static export, metadata routes, TypeScript

---

### Task 1: Document-specific metadata

**Files:**
- Modify: `coldguard-web/src/app/privacy/page.tsx`
- Modify: `coldguard-web/src/app/terms/page.tsx`

**Step 1: Add route metadata exports**

- Add `Metadata` imports.
- Export route-specific `metadata` objects with:
  - unique `title`
  - unique `description`
  - `alternates.canonical` for `/privacy` and `/terms`

**Step 2: Keep pages static-friendly**

- Remove runtime-generated dates.
- Replace them with stable text dates so exported HTML is deterministic.

**Step 3: Verify route intent in generated HTML**

Run: `npm run build`

Expected:
- `out/privacy.html` contains privacy-specific title/description/canonical
- `out/terms.html` contains terms-specific title/description/canonical

### Task 2: Rewrite legal copy

**Files:**
- Modify: `coldguard-web/src/app/privacy/page.tsx`
- Modify: `coldguard-web/src/app/terms/page.tsx`

**Step 1: Expand privacy policy**

- Include operator identity, website, contact email, Google/Firebase auth data usage, telemetry/device data, data sharing, retention, security, children, international access, updates, and contact instructions.

**Step 2: Expand terms**

- Include project status, acceptable use, account security, availability, educational/medical disclaimers, ownership, termination, liability, changes, and contact information.

**Step 3: Verify content is visible in exported HTML**

Run: `npm run build`

Expected:
- `out/privacy.html` contains legal headings and contact email
- `out/terms.html` contains project/student framing and disclaimer language

### Task 3: Publish crawler signals

**Files:**
- Create: `coldguard-web/src/app/robots.ts`
- Create: `coldguard-web/src/app/sitemap.ts`

**Step 1: Add robots metadata route**

- Allow all user agents to crawl.
- Point to `https://coldguard.org/sitemap.xml`.

**Step 2: Add sitemap metadata route**

- Include `/`, `/privacy`, and `/terms`.

**Step 3: Verify generated artifacts**

Run: `npm run build`

Expected:
- `out/robots.txt` exists
- sitemap output is generated in the export output

### Task 4: Validate the export

**Files:**
- Inspect only: `coldguard-web/out/privacy.html`
- Inspect only: `coldguard-web/out/terms.html`
- Inspect only: `coldguard-web/out/robots.txt`

**Step 1: Build the site**

Run: `npm run build`

Expected:
- Next export completes successfully

**Step 2: Inspect generated artifacts**

Run: `Get-Content out\\privacy.html`
Run: `Get-Content out\\terms.html`
Run: `Get-Content out\\robots.txt`

Expected:
- policy pages are plain HTML with legal content
- robots file clearly permits crawling

**Step 3: Prepare deployment follow-up**

- Summarize that Cloudflare Pages must be redeployed from the updated export.
- After deployment, re-run live checks against `/privacy`, `/terms`, and `/robots.txt`.

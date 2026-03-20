# Google Review Legal Pages Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the reviewer-facing ColdGuard website pages pass Google OAuth scrutiny without redesigning the homepage, while restoring a stable `/device/[id]` QR handoff route on the Cloudflare Workers deployment.

**Architecture:** Keep the existing homepage intact and concentrate changes in shared legal/contact components plus the public device route. Implement a reusable legal-page shell for consistent operator identity and contact details, then add a defensive server-rendered device handoff page that tolerates missing query parameters and preserves the canonical HTTPS enrollment URL.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, OpenNext for Cloudflare Workers

---

### Task 1: Document the shared compliance surface

**Files:**
- Modify: `coldguard-web/src/components/Footer.tsx`
- Modify: `coldguard-web/src/app/layout.tsx`

**Step 1: Update footer content**

- Add both public contact emails.
- Keep `Privacy Policy` and `Terms of Service` links prominent.
- Add the University of Mines and Technology identity in a compact reviewer-friendly form.

**Step 2: Normalize metadata**

- Ensure root metadata stays consistent with the public operator identity and `coldguard.org`.

**Step 3: Run local checks**

Run: `npm run build`
Expected: PASS

### Task 2: Rebuild the privacy page for reviewer clarity

**Files:**
- Modify: `coldguard-web/src/app/privacy/page.tsx`

**Step 1: Restructure top-of-page summary**

- Put operator identity, website, public contact emails, and last updated date near the top.
- Add a short summary block describing what the app collects and why.

**Step 2: Make Google Sign-In usage explicit**

- Add a dedicated section covering account/profile data received from Google Sign-In or Firebase Authentication.
- State clearly that Google data is used for authentication and account access, not sold.

**Step 3: Clarify sharing, retention, rights, and contact**

- Present categories clearly enough for a reviewer to scan quickly.

**Step 4: Run local checks**

Run: `npm run build`
Expected: PASS

### Task 3: Rebuild the terms page to match the privacy page

**Files:**
- Modify: `coldguard-web/src/app/terms/page.tsx`

**Step 1: Align structure and operator identity**

- Match the privacy page header structure and contact details.

**Step 2: Keep the existing project-specific disclaimers**

- Preserve the student-project framing and medical disclaimer while improving readability.

**Step 3: Run local checks**

Run: `npm run build`
Expected: PASS

### Task 4: Restore the device handoff route

**Files:**
- Create: `coldguard-web/src/app/device/[id]/page.tsx`

**Step 1: Build a defensive server-rendered page**

- Safely handle missing `params`, `searchParams`, `claim`, and `v`.
- Normalize `string | string[] | undefined` values before rendering.

**Step 2: Expose canonical handoff actions**

- Show device ID and public explanation.
- Provide a primary action to open the app and a secondary action to stay on the website.

**Step 3: Add metadata generation guards**

- Ensure `generateMetadata` also handles malformed inputs without throwing.

**Step 4: Run local checks**

Run: `npm run build`
Expected: PASS

### Task 5: Validate the Cloudflare Workers output

**Files:**
- Verify: `coldguard-web/open-next.config.ts`
- Verify: `coldguard-web/wrangler.jsonc`

**Step 1: Build the worker bundle**

Run: `npx opennextjs-cloudflare build`
Expected: PASS

**Step 2: Smoke-test the route output**

Run: inspect the generated output and request `/device/<id>?claim=test&v=1`
Expected: no server exception or `500`

**Step 3: Summarize any deployment follow-up**

- Note whether a fresh deploy is required and whether `assetlinks.json` remains reachable.

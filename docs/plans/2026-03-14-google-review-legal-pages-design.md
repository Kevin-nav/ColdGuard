# Google Review Legal Pages Design

**Date:** 2026-03-14

**Scope**

Preserve the existing ColdGuard homepage design while improving the public reviewer-facing pages that Google OAuth reviewers are likely to inspect: `Privacy Policy`, `Terms of Service`, the shared footer/contact information, and the QR/device handoff page at `/device/[id]`.

**Goals**

- Make the privacy policy clearly satisfy Google reviewer expectations for a public, same-domain, readable explanation of data handling and Google Sign-In usage.
- Keep the homepage visually intact and avoid a broad marketing redesign.
- Ensure public operator identity and contact details are consistent across the website and consent-screen branding.
- Restore a robust HTTPS device landing page that works for QR scans, browser fallback, and Android App Links.

**Approved Constraints**

- Do not redesign the homepage.
- Reviewer clarity takes priority over visual flourish on legal and device pages.
- Public operator identity should reference ColdGuard as a student team from the University of Mines and Technology in Tarkwa, Western Region, Ghana.
- Public contact emails should include `rexbabel48@gmail.com` and `nchorkevin3@gmail.com`.

**Design**

## 1. Privacy Policy

The privacy page should become more explicit and easier to audit. The top of the page should immediately identify the operator, website, last updated date, and a short summary of what ColdGuard collects and why. The page should then clearly separate:

- what data is collected;
- how Google Sign-In data is used;
- how device and institutional data is used;
- when data is shared;
- retention and security;
- user rights and contact paths.

The copy should stay public-facing and straightforward rather than sounding like a generic legal template. Google-related processing should be called out explicitly so a reviewer can quickly confirm that Google account data is not being sold and is only used for authentication and authorized platform access.

## 2. Terms of Service

The terms page should match the privacy page in structure and clarity. It should keep the current medical and availability disclaimers, but should more clearly identify the operator and explain the nature of the project, acceptable use, account responsibilities, and contact information. The goal is credibility and consistency, not aggressive legal language.

## 3. Footer and Public Contact Surface

The shared footer should expose the two public contact emails and make legal links hard to miss. This keeps the homepage design intact while improving reviewer discoverability of the privacy and terms pages.

## 4. Device Handoff Page

`/device/[id]` should be rebuilt as a defensive public landing page that accepts the canonical HTTPS enrollment URL:

`https://coldguard.org/device/<id>?claim=<token>&v=1`

The page should never crash when `claim`, `v`, or even `id` is missing or malformed. It should:

- show the device ID if present;
- explain that the link is used to continue enrollment or reopen a linked device in the ColdGuard app;
- provide a clear primary action to open the app;
- provide a secondary path for browser users;
- preserve the HTTPS URL as the canonical QR target.

This page is intentionally public and reviewer-friendly. It should explain what the link is for without exposing sensitive data in the UI.

**Verification**

- Build `coldguard-web` with Next.js.
- Build the OpenNext Cloudflare Worker bundle.
- Verify the legal pages and device route render successfully.
- Re-test the dynamic route to ensure the previous `500` is gone.

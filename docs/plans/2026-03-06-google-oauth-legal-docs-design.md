# Google OAuth Legal Docs Design

**Problem**

Google OAuth branding verification rejected `https://coldguard.org/privacy` as improperly formatted. The public site is live and serves HTML, so the issue is likely reviewer confidence and crawler/document signals rather than route reachability.

**Goal**

Make `coldguard.org` present privacy and terms pages as unambiguous, public, review-friendly legal documents that support Google OAuth verification.

**Design**

1. Strengthen the legal copy on `/privacy`.
   - Identify the operator as `ColdGuard`.
   - State the website as `coldguard.org`.
   - Publish the contact email `rexbabel48@gmail.com`.
   - Cover account/authentication data, device telemetry, institutional data, service communications, sharing, retention, security, children, international access, policy changes, and user contact.
   - Explicitly mention Google Sign-In / Firebase Auth usage because that is part of the verification review.

2. Strengthen the legal copy on `/terms`.
   - Describe ColdGuard as a student-led educational project.
   - Add acceptable use, account responsibility, service availability, educational/nonprofit framing, medical disclaimer, intellectual property, termination, liability, and governing updates/contact language.

3. Add route-specific metadata.
   - Give `/privacy` and `/terms` their own titles, descriptions, and canonical URLs.
   - Preserve site-wide metadata in the root layout for the rest of the site.

4. Add explicit crawler/discovery files.
   - Add a normal `robots.txt` route that clearly allows public crawling.
   - Add a `sitemap.xml` route that includes `/`, `/privacy`, and `/terms`.

5. Verify static export output.
   - Build the Next static export.
   - Inspect generated `out/privacy.html`, `out/terms.html`, `out/robots.txt`, and sitemap output.

**Why this approach**

The site already returns `200 OK` and real HTML for the legal URLs, so the lowest-risk fix is to improve document clarity and crawler signals rather than changing hosting or routing architecture.

# Auth Institution Linking Design

Date: 2026-03-06
Status: Approved
Source: user-approved design discussion

## Scope Decisions

- Keep Firebase authentication for app identity.
- Remove email verification from the onboarding path.
- Require institution affiliation before app access beyond auth.
- Support two institution link methods:
  - QR code scan/paste
  - Manual institution selection plus nurse credentials
- Seed institution records and nurse onboarding credentials for development/demo use.

## 1. Architecture

Use Firebase only for user identity and Convex for institution affiliation and onboarding credential validation.

Top-level flow:
- User signs in with Google or email/password.
- App checks whether the Firebase user is already linked to an institution in Convex.
- If not linked, app routes to an institution-link choice screen.
- User either scans a QR code or selects an institution and enters nurse-issued credentials.
- Convex validates the request, links the user, and returns the institution handshake token for secure storage.

Design principle:
- Identity proof and institution proof are separate concerns.
- Firebase proves who the user is.
- Institution QR or nurse credentials prove where the user belongs.

## 2. UX Flow

### Signed-in but unlinked

Show a `Link your institution` screen with two actions:
- `Scan QR code`
- `Enter institution credentials`

### QR path

- User scans or pastes `coldguard://institution/<code>`
- App validates prefix locally
- Convex resolves institution by code and links the user

### Credential path

- User loads a searchable institution list
- User selects an institution
- User enters:
  - `staff ID`
  - `passcode`
- App submits institution ID, staff ID, and passcode to Convex
- Convex verifies the credential record and links the user

### Success

- Persist institution handshake token in secure storage
- Route to the next onboarding/home screen

## 3. Data Model

Existing:
- `institutions`
- `users`

New:
- `institutionCredentials`

Suggested fields for `institutionCredentials`:
- `institutionId`
- `staffId`
- `passcode`
- `displayName`
- `role`
- `isActive`
- optional audit metadata such as `lastUsedAt`

Suggested fields for `institutions` seed data:
- `name`
- `code`
- `handshakeToken`
- optional `district`, `region`

## 4. Backend Responsibilities

Convex should own:
- listing institutions for onboarding
- resolving QR institution codes
- validating nurse credentials against the selected institution
- linking the Firebase user to the institution
- returning the institution handshake token after successful link

Recommended mutations/queries:
- query: list institutions
- mutation: link institution by QR code
- mutation: link institution by nurse credentials
- optional mutation/action: seed institutions and institution credentials for dev/demo

## 5. Error Handling

### Institution list

- loading state while fetching
- empty state if no institutions exist
- retry state if fetch fails

### QR path

- invalid QR payload: `This QR code is not a valid ColdGuard institution code.`
- unknown code: `This institution code was not recognized.`
- offline: `You are offline. Reconnect to link your institution.`

### Credential path

- inline missing-field validation
- invalid credentials: `Staff ID or passcode is incorrect.`
- selected institution mismatch: `These credentials do not belong to the selected institution.`
- inactive credential: `This nurse credential has been disabled. Contact your supervisor.`

### Submission behavior

- disable submit buttons while requests are in flight
- prevent duplicate submit
- keep form values after recoverable errors
- map backend error codes to user-facing messages in the screen layer

## 6. Security and Operational Notes

- Use short, operationally practical passcodes.
- Prefer numeric or simple uppercase alphanumeric passcodes for field entry.
- Do not reveal whether the staff ID or passcode was the incorrect part.
- Seed data is for dev/demo only and should be clearly separated from production workflows.

## 7. Testing Strategy

- Unit tests:
  - QR payload parsing
  - credential form validation
  - auth stage transitions for unlinked vs linked users
  - error-code to message mapping
- Integration tests:
  - sign-in to QR link success
  - sign-in to institution list plus credential success
  - invalid credential failure
  - unknown QR code failure
- Manual checks:
  - empty institution list
  - offline onboarding
  - duplicate tap protection

## 8. Immediate Execution Focus

Implement in this order:
1. Update auth/onboarding route model to treat institution linking as the only post-auth gate.
2. Add institution listing and credential-validation APIs in Convex.
3. Add seed data path for institutions and nurse credentials.
4. Build onboarding UI for link-method choice, institution list, and credential entry.
5. Add structured error handling and success routing.

## Notes

- This workspace is not currently a git repository, so this design document could not be committed here.

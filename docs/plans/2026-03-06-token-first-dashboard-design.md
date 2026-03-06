# Token-First Dashboard UI Design

Date: 2026-03-06
Status: Approved
Source: approved discussion on dashboard/profile UI consistency and centralized styling

## Scope Decisions

- Keep the existing restrained ColdGuard visual direction.
- Do not introduce gradients, decorative one-off backgrounds, or page-specific styling flourishes.
- Use the token layer as the raw design contract.
- Add a small shared primitive layer so pages compose approved UI patterns instead of styling from scratch.
- Limit page-level styles to truly screen-specific structure; repeated visual treatment belongs in shared primitives.

## 1. Product Goals

The current dashboard and related screens already use a theme, but they still rely on local `StyleSheet` blocks, ad hoc inline values, and repeated visual patterns implemented separately in each file. That creates drift and makes future style changes expensive because layout and visual decisions are scattered across multiple screens.

This pass should make the UI easier to maintain by centralizing the design contract and moving repeated presentation logic into reusable components. Success means:

- shared screens look intentionally related
- visual changes can be made from a small number of files
- repeated spacing, radius, and typography values stop appearing inline
- pages compose shared primitives rather than inventing their own cards, badges, headers, and rows
- the UI remains clean and polished without becoming ornamental

## 2. Design Principles

The system should follow these rules:

- tokens define the raw visual language: color, spacing, type scale, radii, borders, elevation, and layout constants
- primitives define reusable screen-building patterns: page shell, section header, panel surface, badge, stat chip, avatar treatment, metric row, and hero shell
- route files should primarily compose primitives and pass content
- if a style decision is needed in more than one place, it should not live inside a route file
- if a hardcoded value appears because a token is missing, that is a signal to extend the token layer

This keeps the system flexible without overbuilding a generic component library too early.

## 3. Target Architecture

### Token layer

`src/theme/tokens.ts` remains the source of truth for semantic values. It should be expanded only where the current scale is missing meaningful system values used across the dashboard shell.

Expected additions may include:

- semantic spacing aliases for section rhythm
- additional radii or border widths if current card/pill scales are insufficient
- richer typography tokens for eyebrow, title, section title, label, and metric text
- semantic surface and accent tokens used repeatedly across dashboard components

### Shared primitive layer

A centralized primitive layer should own the repeated patterns currently scattered across:

- `app/(tabs)/home.tsx`
- `app/(tabs)/profile.tsx`
- `app/(tabs)/devices.tsx`
- `app/(tabs)/settings.tsx`
- `app/staff-management.tsx`
- dashboard component files that still define local presentation details

Recommended primitives:

- `DashboardPage` or equivalent shell wrapper for scroll layout and top spacing
- `SectionHeader` for eyebrow, title, and description hierarchy
- `PanelCard` for the standard bordered surface
- `Badge` or `Pill` for role and status chips
- `MetricRow` or key-value presentation for profile and device metadata
- `HeroCard` or dashboard hero wrapper for the top summary block

These primitives should be small, composable, and specific to the dashboard shell rather than pretending to be global UI abstractions for the entire app.

## 4. Screen Composition Rules

After the refactor:

- route files should not define their own visual variants of cards, chips, section headers, or badges
- shared dashboard components should consume tokens through the primitive layer instead of using raw inline numbers
- one-off inline objects should be limited to small stateful overrides such as pressed state color changes
- screen files may still define narrow structural wrappers when necessary, but those wrappers should not encode reusable design choices

This allows layout and style updates to happen centrally. If the card radius, section spacing, or badge treatment changes later, the update should propagate from the system layer instead of requiring screen-by-screen edits.

## 5. Visual Direction

The dashboard shell should feel operational, calm, and precise:

- strong hierarchy through type and spacing
- consistent use of surface containers
- disciplined accent use through primary, success, warning, and danger tokens
- no gradient-first or “AI slop” styling
- no local decorative experiments on individual pages

The UI should look intentional because the system is consistent, not because each page has a different visual gimmick.

## 6. Error Handling And Edge Cases

- loading and error states should continue using shared page and card treatments
- empty states should use the same panel and text hierarchy as the rest of the shell
- role-based differences should change content, not the styling system
- unauthorized states such as non-supervisor access to staff management should still look like part of the same design system

## 7. Testing Strategy

Tests for this pass should focus on structural regressions rather than pixels:

- shared screens still render expected content and role-based states
- shared primitives render stable test IDs where helpful
- route files continue to support current behavior after the styling refactor
- no user-facing behavior regresses while the visual system is centralized

Linting and type-checking should also confirm that the shared primitive layer is used consistently.

## 8. Immediate Execution Focus

Implement in this order:
1. extend tokens only where the current system is missing shared semantic values
2. create or refactor shared dashboard primitives around those tokens
3. migrate route files to compose primitives instead of local styling
4. normalize dashboard component internals to remove hardcoded visual values
5. run focused tests for dashboard screens and app shell rendering

## Notes

- The goal is maintainability first, not a visual redesign.
- Avoid abstracting beyond the dashboard shell unless a pattern is already clearly shared elsewhere.
- Git commit could not be created from the current workspace because it is not recognized as a git repository from this path.

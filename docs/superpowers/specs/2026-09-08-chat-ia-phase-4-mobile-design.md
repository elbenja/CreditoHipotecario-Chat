# Chat IA Phase 4 — Mobile M1–M3

## Goal

Implement the three approved mobile states from `Chat IA - Errores y Mobile.dc.html` at the 390 × 844 reference viewport while preserving the existing desktop experience and reusing the current chat and pinned-data state.

## Scope

Phase 4 includes only:

- M1: empty chat with mobile navigation, three full-width starter rows, composer, and persistent empty-data summary bar.
- M2: conversation with horizontally scrollable metric and follow-up rows plus the collapsed 96px data sheet.
- M3: expanded persistent bottom sheet containing the complete pinned-data panel.

Backend behavior, API contracts, persistence semantics, desktop layout, and unrelated UI are unchanged.

## Responsive Architecture

The existing `App` state and callbacks remain the single source of truth. Mobile components receive the same fields, proposals, changes, scenarios, and handlers as the desktop `PinnedPanel`.

At widths below 768px:

- `TopNav` renders the compact mobile identity/context treatment.
- `EmptyState` changes its content order and replaces wrapped pills with three 45px full-width starter rows.
- `Conversation` adjusts transcript and composer spacing and exposes a mobile bottom sheet instead of the desktop sidebar.
- Metric cards and follow-up suggestions use horizontal overflow with a partially visible next item.

At 768px and above, the current desktop structure and styling remain unchanged.

## Bottom Sheet

The mobile sheet has two user-controlled positions:

- **Collapsed:** a 96px summary surface above the bottom safe area, with a grabber, fixed-data count, assumed-data count, saved-scenario count, and compact save action.
- **Expanded:** an 88dvh surface with 16px top corners, a `rgba(2,6,23,.6)` scrim, scrollable panel content, and a fixed 50px “Guardar como propiedad” footer action.

The sheet opens by tapping the summary or dragging the grabber upward. It closes by tapping the scrim, pressing Escape, or dragging downward. Movement uses a short transform transition and respects reduced-motion preferences. Body content behind the expanded sheet does not scroll.

The expanded sheet reuses the desktop panel's field, proposal, changes, saved-scenario, dirty, recalculate, and delete/undo behavior. Shared subcomponents are styled responsively rather than copied.

## Mobile Details

M1 uses the reference copy “Voy fijando los datos abajo”. It shows the first three starter questions only. The composer appears above a persistent bar reading “Ningún dato fijado todavía”.

M2 retains the latest conversation content in the available height. Metric cards become 150px-wide snap-free horizontal items with the third card peeking into view. Follow-up pills also scroll horizontally. The composer sits immediately above the collapsed sheet.

M3 keeps a small portion of the chat visible above the sheet so the transition reads as an overlay rather than navigation. Field labels are 11px and values 18px on mobile. The panel middle scrolls independently while its header and CTA remain fixed.

Safe-area padding uses `env(safe-area-inset-bottom)` without reproducing device chrome from the mockup.

## Accessibility

- The collapsed summary is a button with an explicit expanded state and descriptive label.
- The expanded sheet is a labelled dialog.
- Escape closes it and focus moves into the sheet on open and returns to the summary on close.
- Interactive rows and grabber controls meet the 44px minimum touch target.
- The scrim is dismissible without swallowing interaction inside the sheet.

## Verification

- Component tests cover collapsed/expanded behavior, summary counts, Escape dismissal, and empty-state mobile copy.
- Existing reducer, persistence, API, and component tests continue to pass.
- Typecheck and production build pass.
- Browser QA compares M1, M2, and M3 at 390 × 844 and checks desktop at a representative wide viewport for regressions.
- A project-root `design-qa.md` records the comparison and must end with `final result: passed` before handoff.

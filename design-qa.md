# Design QA – popup de evento

## Evidence

- Source visual truth path: `C:\Users\heinz\AppData\Local\Temp\codex-clipboard-44ac06a5-d3b8-4594-a47d-9d69254aea4b.png`
- Implementation screenshot path: `C:\Users\heinz\AppData\Local\Temp\igdaperu-event-preview-layout-source-viewport-qa.png`
- Responsive implementation screenshot path: `C:\Users\heinz\AppData\Local\Temp\igdaperu-event-preview-layout-mobile-qa.png`
- Combined comparison input: `C:\Users\heinz\AppData\Local\Temp\igdaperu-event-preview-design-qa-source-viewport.png`
- Viewport: desktop 1582 × 920 CSS px; mobile 390 × 844 CSS px; device scale factor 1.
- Source pixels: 1582 × 920. Desktop implementation pixels: 1582 × 920. Mobile implementation pixels: 390 × 844. No density normalization was needed.
- State: event preview popup open, with date, time, location, Google Maps action, organizer and share action visible.

## Comparison

- Full-view comparison: the popup keeps the existing beige surface, red accent, cover treatment, two-column hierarchy and action area. The implementation is intentionally narrower than the supplied production capture at desktop because the app's modal uses a capped content width; this does not affect the requested metadata refinement.
- Focused region comparison: the location block now has a compact bordered Google Maps action with its external-link icon aligned inline. Date, time, location and organizer use consistent metadata cards, which removes the orphaned icon line and gives the right column a clearer rhythm.
- Responsive evidence: at 390 × 844 there is no horizontal overflow (`body.scrollWidth === 390`), the map action remains inside the location card, and the popup remains scrollable within the viewport.

## Findings

- P3 polish (accepted): the source capture uses a nearly full-width desktop dialog while the current application preserves its existing 1040 px modal cap. This is an established responsive choice and is outside the requested metadata distribution change.
- No actionable P0, P1 or P2 findings remain for this handoff.

## Comparison history

1. Initial comparison found the Google Maps external-link icon wrapping onto its own line and metadata lacking a consistent container rhythm.
2. Updated `EventPreviewDrawer` with explicit metadata copy/value wrappers and a dedicated `event-preview-map-link` control; updated CSS with card spacing, borders, focus state and inline-flex icon alignment.
3. Re-captured desktop and mobile states. The map action is aligned, the cards are visually consistent, and the mobile state has no horizontal overflow.

## Checklist

- [x] Metadata rows have consistent spacing and alignment.
- [x] Google Maps link is a compact, keyboard-focusable action with inline icon.
- [x] Existing title, cover, organizer and share affordances remain intact.
- [x] Desktop and mobile rendered states captured.
- [x] Tests and production build pass.

final result: passed

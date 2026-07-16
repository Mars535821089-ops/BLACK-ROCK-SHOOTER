# Task 8 Report — Native animation and size preview

## Status

Complete. The preview reproduces the v2 `192 × 208` cell geometry, `8 × 11` sheet positioning, `160 ms` frame cadence, `image-rendering: pixelated`, all nine native states, and the `80–224 px` size range with `113 px` as default.

## RED

1. `npm run test:e2e -- tests/preview.spec.ts`
   - Initial environment error: Playwright Chromium was not installed.
   - Installed with `npx playwright install chromium`.
2. Re-ran the focused test before preview implementation.
   - Failed as expected: `getByTestId('pet')` and `getByLabel('State')` found no elements.
3. First implementation run exposed an accessible-name collision between the size slider and its `<output>`.
   - Fixed by making the visible size readout non-labelable, leaving `Pet size` unique to the slider.
4. Full-suite run exposed runner glob overlap.
   - Vitest collected the Playwright spec and Playwright collected Vitest tests.
   - Fixed with a Playwright `*.spec.ts` match and a Vitest exclusion for `tests/preview.spec.ts`.
5. Reduced-motion regression test failed after 1.3 seconds with changing frame values.
   - Fixed by rendering the first frame without starting the interval when `prefers-reduced-motion: reduce` is active.

## GREEN

- Focused/full Playwright: `4 passed`, including all states, all required sizes, exact 160 ms cadence, reduced-motion behavior, and screenshot generation.
- Vitest: `28 passed` across 6 files.
- TypeScript: `tsc --noEmit` passed.
- `git diff --check` passed.

## Visual evidence

- Review contact sheet: `work/preview-evidence/contact-sheet.png` (`840 × 2610`)
- Full preview workbench: `work/preview-evidence/preview-workbench.png` (`1280 × 900`)
- State-size captures: `work/preview-evidence/{state}-{80|113|224}.png` (27 PNGs)

Visual inspection results:

- Complete body and silhouette remain readable at 80, 113, and 224 px.
- No white edge/fringe is visible on the dark review stage.
- A raw-alpha scan of all 57 native state frames found zero non-transparent pixels touching any outer frame edge, including the long sword in `running-left`; no cropping detected.
- Weapon-visible states match `pet-spec`: `running-right`, `running-left`, `waving`, `failed`, and `running`.
- Weapon-hidden states match `pet-spec`: `idle`, `jumping`, `waiting`, and `review`.

## Implementation notes

- The review shell uses a restrained blue-flame scan stage and native telemetry readouts so it is useful for art QA without altering the pet surface itself.
- State and weapon values are sourced directly from `src/pet-spec.ts`; there is no duplicate state map.
- The generated evidence under `work/` is intentionally force-added because the repository normally ignores intermediate work products.

## Concerns

None blocking. The Playwright web server logs the upstream `NO_COLOR`/`FORCE_COLOR` warning, but all tests complete successfully and the warning does not affect rendering or assertions.

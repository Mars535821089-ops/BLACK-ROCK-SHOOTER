# BLACK★ROCK SHOOTER Pet verification — 2026-07-17

## Automated acceptance

- Typecheck: pass (`npm run typecheck`)
- Unit tests: pass (37/37 across 9 files)
- Frame validation: pass (73/73; 0 errors)
- Pet build: pass
- Browser state preview: pass (5/5 Playwright tests; 224 px is a pre-client-patch quality baseline, not final 448 px evidence)
- All-state mapping: pass (every configured sprite row, final frame, and frame wrap)
- Native size preview: pass at 80, 113, and 224 px for all 9 task states
- Weapon visibility mapping: pass for all 9 task states
- Exact accessible name: pass (`BLACK★ROCK SHOOTER` including `★`)
- Reproducible visual evidence: pass (`npm run capture:evidence`)
- Supersampled quality evidence: pass (`npm run capture:quality`)
- Native occupied-edge safety: pass (minimum 4 transparent pixels; 0 edge-touching frames)
- Frame uniqueness: pass (73/73 unique SHA-256 hashes)
- High-resolution source gate: pass (pose sources must be at least 384 × 416 before enlargement)
- Screenshot pixel QA: 18 transparent Playwright captures; 14 green candidates, all alpha 9–32; 0 candidates at alpha ≥65
- Installed path: `/Users/mars/.codex/pets/blueflame`
- Installed contents: exactly `pet.json` and `spritesheet.webp`
- Installed artifact hashes match `dist/blueflame`: pass
- Other custom Pets unchanged: pass (`boba` hashes identical before and after install)
- Repository whitespace check: pass (`git diff --check`)

## Installed artifact hashes

```text
a50292d926058bd756d44c294ee264a131110cfe3b2c33e52631a976cfeafd51  pet.json
2854b5f96e6c4a0e8b7405c78f4e7f5f41e05949a4a1f73fd56b6318635ea63e  spritesheet.webp
```

The installed manifest reports the formal display name `BLACK★ROCK SHOOTER`, sprite version 2, and `spritesheet.webp`.

## Visual evidence

Run `npm run capture:evidence` to regenerate:

- `work/frame-review/contact-sheet.png`, containing all 73 source frames in their native grid positions.
- `work/preview-evidence/<state>-<size>.png`, covering all 9 states at 80, 113, and 224 px.
- `work/preview-evidence/preview-workbench.png`, the deterministic preview workbench capture.

Run `npm run capture:quality` to regenerate the complete 73-frame native/224/80 galleries and `work/task-10/quality-metrics.json`. The production pipeline starts from approved 900–1750 px sources, renders each cell at 768 × 832, then downsamples once with Lanczos3. Relative to the archived prior spritesheet, average occupied bounding-box area is +4.15% native, +3.90% at 224 px, and +4.45% at 80 px; edge strength is +17.71%, +16.06%, and +4.60%, respectively.

Automated checks cover the running, waiting, review, and failed mappings, every other native state, weapon rules, animation cadence and wrap, reduced motion, native size range, full-frame aspect ratio, alpha geometry, and clean transparent frame corners.

## Native Codex self-UI limitation

Scope note: an independent macOS overlay app is deferred/paused and is not part of this delivery. The checks below refer only to Codex's native movable Pet overlay.

The package is installed and `codex://settings/pets` was opened successfully. Codex cannot use Computer Use to control its own app, and the install/spawn API has no Pet selector. Therefore the following native UI observations are deliberately **not marked as passed**:

- Refreshing the Pet list, selecting `BLACK★ROCK SHOOTER`, and clicking **Wake Pet**.
- Watching real tasks transition through running, waiting, review, and failed in the floating overlay.
- Inspecting the native overlay at 80, the pre-client-patch default, and 224 px. Final 448 px display-size acceptance belongs to Task 11 and is not claimed by this record.
- Restarting Codex and confirming the selected size persists.

One manual acceptance pass in **Settings → Pets** is still required for those observations. No opaque Codex database or application bundle was modified to bypass this limitation.

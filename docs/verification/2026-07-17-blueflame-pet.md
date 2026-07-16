# BLACK★ROCK SHOOTER Pet verification — 2026-07-17

## Automated acceptance

- Typecheck: pass (`npm run typecheck`)
- Unit tests: pass (29/29 across 6 files)
- Frame validation: pass (73/73; 0 errors)
- Pet build: pass
- Browser state preview: pass (5/5 Playwright tests)
- All-state mapping: pass (every configured sprite row, final frame, and frame wrap)
- Native size preview: pass at 80, 113, and 224 px for all 9 task states
- Weapon visibility mapping: pass for all 9 task states
- Exact accessible name: pass (`BLACK★ROCK SHOOTER` including `★`)
- Reproducible visual evidence: pass (`npm run capture:evidence`)
- Installed path: `/Users/mars/.codex/pets/blueflame`
- Installed contents: exactly `pet.json` and `spritesheet.webp`
- Installed artifact hashes match `dist/blueflame`: pass
- Other custom Pets unchanged: pass (`boba` hashes identical before and after install)
- Repository whitespace check: pass (`git diff --check`)

## Installed artifact hashes

```text
a50292d926058bd756d44c294ee264a131110cfe3b2c33e52631a976cfeafd51  pet.json
e70204fc4a3cc43e8b5bb860cf2cfc3475e4457a61e6124e862565fe5779ced7  spritesheet.webp
```

The installed manifest reports the formal display name `BLACK★ROCK SHOOTER`, sprite version 2, and `spritesheet.webp`.

## Visual evidence

Run `npm run capture:evidence` to regenerate:

- `work/frame-review/contact-sheet.png`, containing all 73 source frames in their native grid positions.
- `work/preview-evidence/<state>-<size>.png`, covering all 9 states at 80, 113, and 224 px.
- `work/preview-evidence/preview-workbench.png`, the deterministic preview workbench capture.

Automated checks cover the running, waiting, review, and failed mappings, every other native state, weapon rules, animation cadence and wrap, reduced motion, native size range, full-frame aspect ratio, alpha geometry, and clean transparent frame corners.

## Native Codex self-UI limitation

The package is installed and `codex://settings/pets` was opened successfully. Codex cannot use Computer Use to control its own app, and the install/spawn API has no Pet selector. Therefore the following native UI observations are deliberately **not marked as passed**:

- Refreshing the Pet list, selecting `BLACK★ROCK SHOOTER`, and clicking **Wake Pet**.
- Watching real tasks transition through running, waiting, review, and failed in the floating overlay.
- Inspecting the native overlay at 80, default, and 224 px.
- Restarting Codex and confirming the selected size persists.

One manual acceptance pass in **Settings → Pets** is still required for those observations. No opaque Codex database or application bundle was modified to bypass this limitation.

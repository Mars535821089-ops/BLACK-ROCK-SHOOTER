# Final fixes report — 2026-07-17

## Outcome

Final-review fixes are implemented in the isolated `feature/blueflame-pet`
worktree. Production preview acceptance is restored to the official 80–224px
range, default 113px, `image-rendering: pixelated`, and exact
`BLACK★ROCK SHOOTER`. The 448px work is isolated and documented as a blocked,
not-applied forensic experiment. The live app and installed Pet were audited
read-only.

## Code and test changes

- Added `isAppRunning()` as the first operation of native `apply`.
- Added a live-safe-stage regression proving running-app refusal has zero
  backend mutations, unchanged live/stage bytes, and no backup creation.
- Preserved the restore running-app guard and verified rollback behavior.
- Restored Playwright and evidence sizes to 80/113/224.
- Restored default 113, max 224, and pixelated rendering in production preview.
- Made clock-based animation evidence deterministic with a paused clock and
  `runFor` interval advancement.
- Extended transparent pixel evidence to all 27 state/size combinations.
- Marked the implementation plan as a historical recipe, not a checkbox status
  tracker.
- Reconciled Task 10/11 and final verification documentation.

## Focused verification

```text
npm test -- tests/pixel-qa.test.ts tests/native-pet-patch.test.ts tests/native-pet-bundle.test.ts
Test Files  3 passed (3)
Tests       27 passed (27)
```

Native bundle test alone after the TDD change:

```text
npm test -- tests/native-pet-bundle.test.ts
Test Files  1 passed (1)
Tests       15 passed (15)
```

Preview/evidence was rerun twice consecutively after fixing the clock race;
both runs passed 2/2 targeted tests and produced the same QA totals.

## Fresh complete verification

```text
npm run typecheck
PASS (exit 0)

npm test
Test Files  11 passed (11)
Tests       62 passed (62)

npm run test:e2e
5 passed

npm run validate:pet
73 frames valid; 0 errors

npm run build:pet
PASS (exit 0)

npm run capture:evidence
2 passed
preview pixel QA: 27 screenshots; green candidates=10; opaque green=0;
low-alpha bright candidates=12202

git diff --check
PASS (exit 0)
```

Full raw output is retained in ignored local evidence at
`work/final-fixes-verification.log`.

## Installed Pet and sibling isolation

No install command was run during final review. Hash audit:

```text
dist/blueflame/pet.json == ~/.codex/pets/blueflame/pet.json
a50292d926058bd756d44c294ee264a131110cfe3b2c33e52631a976cfeafd51

dist/blueflame/spritesheet.webp == ~/.codex/pets/blueflame/spritesheet.webp
2854b5f96e6c4a0e8b7405c78f4e7f5f41e05949a4a1f73fd56b6318635ea63e

boba/pet.json pre-install baseline == current
a5f00ef46e5dc981430286cc11bad3b54fca73551f66ac47faa71d3ecc47f75c

boba/spritesheet.webp pre-install baseline == current
b2a723fc55ac6af867765dedc26b3841fbf178d7e1025d6011e8d96ac44f19c9
```

## Live app unchanged/trusted evidence

```text
npm run patch:native-pet -- verify --mode original --app /Applications/ChatGPT.app
classification: original-trusted
version: 26.707.72221
asarHash: b5da51e5df6e996076e4cb19045cec46dd4c08cf61c19cdbc5cb426b8413b73c
headerHash: 9d7676e404b1b984f571edc89db3786bc2478608d343762b5e7d6d1616780f78
recordedHeaderHash: same
targetIntegrityValid: true

codesign --verify --deep --strict /Applications/ChatGPT.app
PASS

Identifier=com.openai.codex
Authority=Developer ID Application: OpenAI OpCo, LLC (2DC432GLL2)
TeamIdentifier=2DC432GLL2

spctl -a -vv -t exec /Applications/ChatGPT.app
accepted
source=Notarized Developer ID
```

Full raw output is retained in ignored local evidence at
`work/final-fixes-audit.log`.

## Remaining manual step

The user must still open **Settings → Pets**, refresh/select
`BLACK★ROCK SHOOTER`, click **Wake Pet**, observe native live task transitions,
check 80/default-113/224 rendering, and restart once to verify size persistence.
Those native observations are intentionally not reported as passed.

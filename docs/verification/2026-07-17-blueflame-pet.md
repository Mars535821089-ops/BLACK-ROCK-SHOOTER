# BLACK★ROCK SHOOTER Pet verification — 2026-07-17

## Accepted production outcome

The accepted delivery is the official Codex custom Pet contract:

- exact display name: `BLACK★ROCK SHOOTER`;
- sprite v2: 1536 × 2288, 8 × 11 cells, 192 × 208 per cell;
- production preview slider: 80–224px;
- production default: 113px;
- production rendering: `image-rendering: pixelated`;
- evidence sizes: 80, 113, and 224px for all nine task states.

No production preview or acceptance claim implies that 448px is live.

## Fresh automated verification

The following commands were run fresh, in this order, against the current
worktree state:

```sh
npm run typecheck
npm test
npm run test:e2e
npm run validate:pet
npm run build:pet
npm run capture:evidence
git diff --check
```

Results:

- TypeScript: pass, exit 0.
- Unit suite: 11 test files, 62 tests passed, 0 failed.
- Playwright suite: 1 file, 5 tests passed, 0 failed.
- Frame validation: 73 frames valid, 0 errors.
- Pet build: pass, exit 0.
- Evidence capture: 2 targeted Playwright tests passed; 27 transparent
  screenshots produced (9 states × 80/113/224); 10 green candidates, 0 opaque
  green pixels, and 12,202 low-alpha bright diagnostic candidates.
- Repository whitespace check: pass, exit 0.

Focused patcher/pixel QA was also run separately:

```sh
npm test -- tests/pixel-qa.test.ts tests/native-pet-patch.test.ts tests/native-pet-bundle.test.ts
```

Result: 3 files, 27 tests passed. This includes the new running-app apply
regression: with an otherwise live-safe staged bundle, `apply` refuses before
inspection/mutation, records zero backend mutations, leaves live and stage
bytes unchanged, and creates no backup. The restore running-app guard remains.

The preview evidence timing test uses a paused Playwright clock and `runFor`, so
the configured final frame and wrap are observed deterministically instead of
depending on real-time interval races.

## Package and isolation audit

The installed custom Pet was hash-audited only; it was not reinstalled or
mutated during final review. Distribution and installed hashes match:

```text
a50292d926058bd756d44c294ee264a131110cfe3b2c33e52631a976cfeafd51  pet.json
2854b5f96e6c4a0e8b7405c78f4e7f5f41e05949a4a1f73fd56b6318635ea63e  spritesheet.webp
```

The only sibling custom Pet is `boba`; its two hashes still match the recorded
pre-install baseline:

```text
a5f00ef46e5dc981430286cc11bad3b54fca73551f66ac47faa71d3ecc47f75c  boba/pet.json
b2a723fc55ac6af867765dedc26b3841fbf178d7e1025d6011e8d96ac44f19c9  boba/spritesheet.webp
```

## Live application trust audit

`/Applications/ChatGPT.app` was read-only audited and remains the exact official
bundle:

- version `26.707.72221`;
- `app.asar` SHA-256
  `b5da51e5df6e996076e4cb19045cec46dd4c08cf61c19cdbc5cb426b8413b73c`;
- ASAR header and recorded header SHA-256 both
  `9d7676e404b1b984f571edc89db3786bc2478608d343762b5e7d6d1616780f78`;
- target integrity valid;
- classification `original-trusted`;
- Developer ID `OpenAI OpCo, LLC (2DC432GLL2)` and team `2DC432GLL2`;
- `codesign --verify --deep --strict`: pass;
- designated requirement: satisfied;
- Gatekeeper: accepted, source `Notarized Developer ID`.

The live app was not modified, quit, or restarted.

## 448px forensic experiment

The 448px patcher is retained only as a clearly labeled, version-pinned
forensic experiment. Its content-valid staged app requires ad-hoc signing and
cannot preserve OpenAI's Developer ID, designated requirement, notarization, or
Gatekeeper acceptance. `live-safe` therefore blocks it and it was **not
applied**. It is not production preview evidence.

An independent macOS overlay is deferred and is not part of this delivery.

## Honest manual acceptance boundary

Automated verification cannot operate Codex's own native Pet selector through
the available install/spawn API. These observations remain unverified until the
user clicks them in the current app:

- refresh/select `BLACK★ROCK SHOOTER` in **Settings → Pets**;
- click **Wake Pet** and confirm the floating native Pet appears;
- observe live running, waiting, review, and failed transitions;
- inspect native rendering at 80, default 113, and 224px;
- restart Codex and confirm the chosen size persists.

No native selector, Wake, live transition, or persistence pass is claimed here.

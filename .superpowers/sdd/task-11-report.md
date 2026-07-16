# Task 11 report — experimental native Codex Pet 448px patch

## Final disposition

Task 11 is a **forensic staged experiment, blocked and not applied**. It is not
part of the accepted production Pet delivery. The production preview and
Playwright contract are restored to Codex's official 80–224px range, default
113px, `image-rendering: pixelated`, and the exact display name
`BLACK★ROCK SHOOTER`.

An independent macOS overlay remains deferred and was not built or installed.

## Why live apply is blocked

The version-pinned patch changes `app.asar` and
`Info.plist:ElectronAsarIntegrity`. The locally staged bundle can be ad-hoc
signed and content-verified, but it cannot retain OpenAI's Developer ID,
designated requirement, notarization, or Gatekeeper acceptance. Therefore:

- `verify --mode patched-staged` classifies the exact stage as
  `patched-staged-untrusted`;
- `verify --mode live-safe` rejects it;
- `apply` refuses before filesystem mutation;
- `/Applications/ChatGPT.app` remains the official trusted bundle.

The experimental source stays isolated in `src/native-pet-patch.ts`,
`src/native-pet-bundle.ts`, `scripts/native-pet-patcher.ts`, and their tests.
It does not alter the production preview.

## Safety behavior

`apply` now checks `isAppRunning()` as its first operation. If ChatGPT is
running, it refuses before any live-safe/original inspection or any live,
stage, backup, replacement, or swap mutation. A regression test supplies an
otherwise live-safe staged bundle and proves zero backend mutations and no
backup creation. The existing restore running-app guard and verified rollback
path remain intact.

The patcher otherwise retains exact version/hash checks, byte-length-preserving
replacement checks, independent ASAR integrity verification, distinct
`original` / `patched-staged` / `live-safe` trust modes, safe backup reuse, and
whole-bundle rollback verification.

## Forensic hashes for Codex 26.707.72221

- Official `app.asar` SHA-256:
  `b5da51e5df6e996076e4cb19045cec46dd4c08cf61c19cdbc5cb426b8413b73c`
- Official ASAR header SHA-256:
  `9d7676e404b1b984f571edc89db3786bc2478608d343762b5e7d6d1616780f78`
- Experimental patched ASAR SHA-256:
  `2d8ff6b09ae040f58cf796f68b8b820e4d5965aaac61a5ac20ec6ac982279f69`
- Experimental patched header SHA-256:
  `fb065e6ef3792855e4baf20b37e0a41676c78eb0cb02a948d421dc3003ffb392`

These are version-pinned forensic facts, not authorization to apply the patch.

## Acceptance boundary

No native 448px slider, 448px floating Pet, restart, or size-persistence claim
is made. Current native selector visibility, **Wake Pet**, live task-state
transitions, 80/default-113/224 rendering, and persistence still require the
user's manual pass in the current Codex app.

Fresh final-suite commands and exact totals are recorded in
`.superpowers/sdd/final-fixes-report.md` and
`docs/verification/2026-07-17-blueflame-pet.md`.

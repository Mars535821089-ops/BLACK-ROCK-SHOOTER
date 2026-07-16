# Task 7 Report: CLI and Contact-Sheet Review

## Scope

- Added `src/cli.ts` with `validate`, `build`, `install`, and `contact-sheet` commands.
- Added `src/contact-sheet.ts` to compose all 73 source frames onto an opaque review sheet.
- Added `tests/cli.test.ts` for supported/unsupported command parsing.
- Preserved the internal build/install slug `blueflame` and the manifest display name `BLACK★ROCK SHOOTER`.

## RED evidence

Command:

```text
npm test -- tests/cli.test.ts
```

Observed failure before production code existed:

```text
FAIL tests/cli.test.ts
Error: Cannot find module '../src/cli.js'
Test Files 1 failed (1)
```

The failure was caused by the missing CLI module required by the new behavior test.

## GREEN evidence

Focused test after implementation:

```text
npm test -- tests/cli.test.ts
Test Files 1 passed (1)
Tests 1 passed (1)
```

Real frame validation:

```text
npm run validate:pet
73 frames valid; 0 errors
```

Build and review outputs:

```text
npm run build:pet
npx tsx src/cli.ts contact-sheet
```

Both commands exited 0. Sharp metadata confirmed both outputs are 1536x2288 with alpha; the spritesheet is WebP and the contact sheet is PNG. The contact sheet was also visually inspected.

Installer smoke test:

```text
CODEX_HOME=<temporary-directory> npm run install:pet
```

The temporary install exited 0 and contained `pet.json` plus `spritesheet.webp`; its manifest retained `BLACK★ROCK SHOOTER`.

Full verification:

```text
npm test
Test Files 6 passed (6)
Tests 19 passed (19)

npm run typecheck
exit 0
```

## Self-review

- CLI orchestration uses the existing frame validator, spritesheet assembler, manifest writer, and atomic installer.
- Build artifacts are validated before build success and again before/during installation.
- No real `~/.codex/pets` installation was performed; installer verification used an isolated temporary `CODEX_HOME`.
- Contact-sheet placement uses `PET_SPEC` dimensions rather than duplicating cell constants.

## Review-finding TDD follow-up

### RED evidence

After adding strict build-validation, orchestration, path enumeration, install-routing, command-isolation, and contact-sheet geometry tests:

```text
npm test -- tests/cli.test.ts
Test Files 1 failed (1)
Tests 8 failed | 1 passed (9)
```

The failures specifically showed the missing `runCommand`, `validateBuild`, and `lookCellFor` seams, and that `validateAll` could not yet receive a deterministic frame validator.

### GREEN evidence

Focused tests after implementation:

```text
npm test -- tests/cli.test.ts
Test Files 1 passed (1)
Tests 9 passed (9)
```

Full automated verification:

```text
npm run typecheck
exit 0

npm test
Test Files 6 passed (6)
Tests 27 passed (27)
```

Fresh real-asset smoke verification:

```text
npm run validate:pet
73 frames valid; 0 errors

npm run build:pet
npx tsx src/cli.ts contact-sheet
CODEX_HOME=<temporary-directory> npm run install:pet
```

All commands exited 0. Metadata checks confirmed an exact `webp` 1536x2288 alpha spritesheet and an exact `png` 1536x2288 alpha contact sheet. The temporary install created `pets/blueflame` without touching the real home directory.

### Review resolutions

- `validateBuild` now requires deep equality with `createManifest()`, rejecting missing, changed, or extra fields, and requires actual WebP format plus exact dimensions and alpha.
- `runCommand` provides narrow dependency and path/runtime seams for deterministic orchestration tests while CLI defaults remain unchanged.
- Tests assert the exact ordered set of 73 frame paths, build destinations and post-build validation, corrupted manifest/format rejection, isolated `CODEX_HOME` routing, supported-command isolation, and contact-sheet geometry.
- Look rows are derived from `PET_SPEC.rows - 2`; a variable-geometry test prevents regression to a hardcoded row index.

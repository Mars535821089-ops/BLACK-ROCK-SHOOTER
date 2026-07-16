# Task 10 report — 4× supersampled visual-quality upgrade

## Status

Complete. All 73 BLACK★ROCK SHOOTER frames were rebuilt from the approved high-resolution master and generated key-pose cutouts. The old 192 × 208 frames were archived for comparison only and were never enlarged as production inputs. The lossless Codex v2 sheet was rebuilt and installed atomically to `~/.codex/pets/blueflame` after every automated and visual gate passed.

The independent macOS overlay idea is explicitly deferred/paused. This delivery changes only the native movable Codex Pet asset, preview, evidence, build, and installation chain.

## Source and pipeline

- Source of truth: `assets/master/blueflame-master.png` (909 × 1731) plus 17 approved transparent key-pose sources under `assets/key-poses/` (smallest source edge 898 px; largest dimensions 1645 × 956).
- No image-generation call was needed for Task 10; it reused the already approved high-resolution sources.
- Each pose is chroma-despilled before transformation. Rotations happen at source resolution before sizing so the entire rotated silhouette remains within the requested fit.
- Production intermediate per cell: exact `768 × 832` RGBA (4 × the final cell in each axis).
- Character fit: maximum safe pose-specific width/height, clamped against a 16-pixel intermediate safety border, equivalent to 4 final transparent pixels.
- Downsample: Sharp/libvips Lanczos3, once, from 768 × 832 to 192 × 208.
- Detail pass: restrained sharpen (`sigma 0.45`, `m1 0.32`, `m2 0.12`).
- Matte pass: alpha samples `<= 8` cleared, hidden transparent RGB zeroed, green spill removed, and the final 4-pixel border forced transparent to prevent Lanczos ringing from crossing the safety edge.
- Final assembly: exact lossless-alpha WebP, 1536 × 2288, 8 × 11 cells, 192 × 208 each.
- Reproducible commands: `npm run render:frames`, `npm run capture:evidence`, and `npm run capture:quality`.

The pose pipeline rejects any source below 384 × 416 before rotation, resize, or enlargement; the supersample finalizer separately rejects any intermediate that is not exactly 768 × 832. Regression tests exercise direct 192 × 208 rejection at both boundaries.

## Before evidence

Captured before replacement:

- Old sheet: `work/task-10/before/spritesheet.webp`
- Native contact sheet: `work/task-10/before/contact-sheet-native.png`
- Complete 73-frame galleries: `work/task-10/before/all-frames-{192|224|80}.png`
- Preview: `work/task-10/before/preview-workbench.png`
- Old sheet SHA-256: `e70204fc4a3cc43e8b5bb860cf2cfc3475e4457a61e6124e862565fe5779ced7`

After evidence:

- Native contact sheet: `work/task-10/after/contact-sheet-native.png`
- Complete 73-frame galleries: `work/task-10/after/all-frames-{192|224|80}.png`
- Preview: `work/task-10/after/preview-workbench.png`
- Raw metrics: `work/task-10/quality-metrics.json`

`preview-workbench.png` and every Task 10 `*-224.png` capture are strictly pre-client-patch quality baselines for comparing the supersampled sprite. They are not final 448 px evidence and do not establish final display-size acceptance. Task 11 owns the 80–448 preview, 448 default, tighter stage layout, and corresponding final-size evidence.

## Objective before/after measurements

All averages cover the same 73 frames. Display-scale edge/detail values use smooth cubic resampling to approximate browser CSS scaling; the production 4× reduction itself remains Lanczos3.

| Display width | Avg bbox before | Avg bbox after | Bbox area | Occupied pixels | Edge strength | Interior detail |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Native 192 | 105.04 × 179.56 | 107.29 × 182.89 | +4.15% | -0.48% | +17.71% | +25.87% |
| 224 | 123.32 × 210.49 | 125.88 × 214.04 | +3.90% | +0.74% | +16.06% | +22.92% |
| 80 | 44.64 × 75.89 | 45.52 × 77.67 | +4.45% | +2.69% | +4.60% | +4.52% |

Native minimum occupied-edge margin improved from 1 pixel to 4 pixels. The new native frames contain 0 green-dominant candidates, 0 hidden RGB pixels under alpha 0, and 0 edge-touching frames; unit regressions assert all three native properties. Display-scale interpolation candidates and real browser screenshot results are reported separately in the review follow-up below rather than being labeled zero-fringe by inference.

Native occupied-pixel count is 0.48% lower despite a 4.15% larger bounding box because the new matte removes low-alpha ringing and the restrained detail pass makes edges more decisive. At the actual 224 and 80 display sizes, occupied-pixel count is higher.

## Visual QA

Inspected every state row and all 73 frames in the native, 224, and 80 galleries. Confirmed:

- complete hair, head flame, body, boots, sword, and motion silhouettes;
- viewer-right flame placement and no generated green fringe;
- full sword only in approved weapon states;
- stable face, adult seven-head proportions, outfit, star emblem, palette, and baseline intent;
- separately authored left/right movement and readable 16-direction look sequence;
- readable face/hair separation, clothing highlights, and sword edge at 224 and 80;
- no white halo, crushed black, oversharpening, stretched-bitmap artifacts, crop, or scale jump.

One quality-gate failure was found before installation: idle frames 0 and 3 became byte-identical because the intended 1-pixel breathing translation was correctly clamped by the new 4-pixel safety border. Root cause was fixed by expressing frame 3 as a restrained `-0.12°` sway instead. A new regression test now requires 73/73 unique frame hashes.

## Preview and evidence hardening

- For this pre-client-patch baseline only, preview default and evidence are 224 px and the slider remains 80–224 px. This is not the final 448 px acceptance surface.
- Smooth rendering replaces the prior `pixelated` preview enlargement.
- Visible title and all dynamic/static ARIA labels use exact `BLACK★ROCK SHOOTER` spelling.
- `capture:evidence` now executes both the all-state configured-row/final-frame/wrap test and the screenshot capture test.
- `capture:quality` regenerates the complete 73-frame native/224/80 galleries and objective comparison JSON.

## Final automated verification

Fresh final runs after the duplicate-frame fix:

```text
npm run typecheck       exit 0
npm test                9 files passed; 37 tests passed
npm run validate:pet    73 frames valid; 0 errors
npm run build:pet       exit 0
npm run test:e2e        5 tests passed
npm run capture:evidence 2 evidence tests passed
npm run capture:quality 73-frame galleries and metrics generated
git diff --check        exit 0
```

Additional raw gate:

```text
frames=73
unique=73
minimumNativeMargin=4
greenDominantPixels=0
edgeTouchingFrames=0
```

## Atomic installation and isolation

Installed with `npm run install:pet` only after all gates passed. Staging was validated before rename. The temporary old-version backup was removed only after the installed files matched the rebuilt distribution hashes.

Installed directory contains exactly:

```text
/Users/mars/.codex/pets/blueflame/pet.json
/Users/mars/.codex/pets/blueflame/spritesheet.webp
```

Dist and installed hashes match:

```text
a50292d926058bd756d44c294ee264a131110cfe3b2c33e52631a976cfeafd51  pet.json
2854b5f96e6c4a0e8b7405c78f4e7f5f41e05949a4a1f73fd56b6318635ea63e  spritesheet.webp
```

Installed sheet metadata: WebP, 1536 × 2288, alpha true, 4 channels. Installed manifest display name is exact `BLACK★ROCK SHOOTER`, sprite version is 2, and spritesheet path is `spritesheet.webp`.

Sibling `boba` hashes are unchanged from before install:

```text
a5f00ef46e5dc981430286cc11bad3b54fca73551f66ac47faa71d3ecc47f75c  boba/pet.json
b2a723fc55ac6af867765dedc26b3841fbf178d7e1025d6011e8d96ac44f19c9  boba/spritesheet.webp
```

Only `blueflame` and `boba` remain under `~/.codex/pets`; no staging or backup directory remains. No ChatGPT/Codex application bundle, `app.asar`, opaque database, or sibling Pet was modified.

## Concerns

No asset, build, test, or installation blocker remains. Native self-UI selection and live task-state observation still require one manual pass in Codex Settings because Codex cannot control its own UI and the available spawn API exposes no Pet selector. The independent macOS overlay app remains deferred/paused by scope.
Final 448 px preview and native display-size acceptance are intentionally not claimed here; they belong to Task 11.

## Important review follow-up

### Pixel-QA method and actual counts

The original report's zero-pixel wording for scaled evidence was too broad. It has been removed and replaced with two explicit measurements using the same candidate threshold: occupied alpha `>= 9`, and green candidate `g > r + 25` plus `g > b + 20`.

1. The deterministic 73-frame quality gallery uses Sharp cubic scaling over the entire transparent frame. It reports candidate pixels, not a fringe verdict:

```text
native 192: 0
224: 419 total = alpha 9–32: 372; 33–64: 43; 65–128: 4; 129–255: 0
80: 59 total = alpha 9–32: 59; all higher bins: 0
```

These low-alpha samples are cubic interpolation overshoot. The absence of any alpha `>128` candidate is recorded, but the 419/59 totals are retained in `work/task-10/quality-metrics.json`; they are not rewritten as zero.

2. The real browser path captures 18 transparent-background Playwright element screenshots: every native state at 80 and 224 px. The exact scan region is the complete transparent element image; only alpha `>=9` is occupied. Results in `work/task-10/after/preview-pixel-qa.json` are:

```text
occupied pixels: 116724
green candidates: 14
  alpha 9–32: 14
  alpha 33–255: 0
high-confidence green candidates (alpha >=65): 0
low-alpha bright diagnostic candidates: 7709
```

The 7,709 bright candidates are diagnostic only, not classified as white fringe, because the character intentionally contains white hair highlights, pale skin, a white star emblem, and bright clothing/sword highlights. Contact-sheet visual review remains the appropriate white-halo check. Automated tests assert the threshold implementation, the native zero-candidate/zero-hidden-RGB matte, the real screenshot absence of alpha `>=65` green candidates, and the 4-pixel native occupied margin.

### Source-resolution and occupied-margin gates

- `assertHighResolutionSource` rejects key-pose inputs below 384 × 416 before any enlargement; a real 192 × 208 buffer is the RED/GREEN regression fixture.
- `finalizeSupersampledFrame` still requires the exact 768 × 832 intermediate.
- The complete asset regression calculates alpha bounds for all 73 PNGs and requires every side of every frame to retain at least 4 transparent pixels.

### Evidence command/output consistency

`npm run capture:evidence` now regenerates:

- `work/frame-review/contact-sheet.png`
- `work/preview-evidence/<state>-<80|113|224>.png`
- `work/preview-evidence/preview-workbench.png`
- `work/task-10/after/contact-sheet-native.png`
- `work/task-10/after/preview-workbench.png`
- `work/task-10/after/pixel-qa/<state>-<80|224>.png`
- `work/task-10/after/preview-pixel-qa.json`

`npm run capture:quality` regenerates:

- `work/task-10/after/all-frames-{192|224|80}.png`
- `work/task-10/quality-metrics.json`

The fresh complete verification transcript is `work/task-10/full-verification.log`.

All 224 px paths above are labeled pre-client-patch quality baselines only. They must not be used as the final 448 px preview evidence.

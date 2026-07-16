# Codex BLACK★ROCK SHOOTER Pet Implementation Plan

> **Historical execution record (2026-07-17):** The unchecked boxes below are
> preserved verbatim as the original implementation recipe; they are not a live
> progress tracker. Actual completion and remaining manual acceptance are
> recorded in `.superpowers/sdd/progress.md` and
> `docs/verification/2026-07-17-blueflame-pet.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, install, and verify a selectable Codex custom Pet that matches the approved seven-head anime character design and communicates Codex task state through native v2 sprite animations.

**Architecture:** A TypeScript asset pipeline owns the Codex v2 grid specification, validates generated frames, assembles a lossless transparent WebP spritesheet, writes `pet.json`, and installs both files atomically into `~/.codex/pets/blueflame`. Art production is gated by one approved master character image, then derives every state frame from that master to preserve identity. A local browser preview reproduces Codex's `image-rendering: pixelated`, native frame timing, and 80–224 px size range before installation.

**Tech Stack:** Node.js 22+, TypeScript, Sharp, Vitest, Vite, Playwright, Codex custom Pet v2 (`1536 × 2288`, 8 × 11 grid, `192 × 208` cells), WebP with alpha.

## Global Constraints

- The character uses a normal seven-head anime proportion and must remain visible from head to toe in every frame.
- The visual identity stays close to the supplied references: black high twin-tails, side fringe, ice-blue eyes, blue flame above the viewer-right eye (character anatomical left), cropped black hooded jacket with white sleeve stripe and star mark, black shorts, white belt, black gloves, and knee-high tactical boots.
- Rendering is smooth cel-shaded anime, not chibi and not intentionally coarse pixel art.
- The black long sword with a silver-blue edge is hidden for `idle`, `waiting`, `review`, and `jumping`; it is visible for `running`, `running-left`, `running-right`, `waving`, and `failed` according to the approved actions.
- Character face, hair, outfit, body ratio, colors, and weapon design must stay consistent across all frames.
- The final spritesheet is exactly `1536 × 2288`, 8 columns × 11 rows, with `192 × 208` cells and a transparent background.
- The Pet must use the existing Codex `Pet size` slider and remain legible at 80 px, the default size, and 224 px.
- Installation must not modify `/Applications/ChatGPT.app`, `app.asar`, built-in Pets, or any other custom Pet.
- Updates use a staging directory and backup; an invalid build must never replace the installed Pet.

---

## File Map

- `package.json` — scripts and runtime/dev dependencies.
- `tsconfig.json` — strict TypeScript configuration.
- `src/pet-spec.ts` — one source of truth for grid geometry, state rows, frame counts, and weapon visibility.
- `src/validate-frame.ts` — validate individual transparent PNG frames.
- `src/assemble-spritesheet.ts` — place frames into the Codex v2 grid and encode lossless WebP.
- `src/manifest.ts` — construct and validate `pet.json`.
- `src/install-pet.ts` — atomic install, backup, and rollback.
- `src/cli.ts` — `validate`, `build`, and `install` commands.
- `preview/index.html` — interactive native-size animation and slider preview.
- `preview/main.ts` — state switching and Codex-compatible frame playback.
- `assets/master/blueflame-master.png` — approved full-body character master.
- `assets/master/character-lock.json` — immutable visual decisions sampled from the approved master.
- `assets/frames/<state>/<column>.png` — normalized source frames.
- `assets/frames/look/<direction>.png` — 16 cursor-looking frames for v2 rows 9–10.
- `dist/blueflame/spritesheet.webp` — final Codex sprite asset.
- `dist/blueflame/pet.json` — final Codex Pet manifest.
- `tests/pet-spec.test.ts` — grid and state contract tests.
- `tests/validate-frame.test.ts` — frame geometry/alpha tests.
- `tests/assemble-spritesheet.test.ts` — output dimension and placement tests.
- `tests/manifest.test.ts` — manifest schema tests.
- `tests/install-pet.test.ts` — staging, backup, rollback, and isolation tests.
- `tests/preview.spec.ts` — browser checks for state switching and size control.

---

### Task 1: Scaffold the tested asset pipeline

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/pet-spec.ts`
- Create: `tests/pet-spec.test.ts`

**Interfaces:**
- Produces: `PET_SPEC`, `STATE_NAMES`, `cellFor(state, column)`, and `weaponVisibleFor(state)` for every later task.

- [ ] **Step 1: Write the grid and state contract test**

```ts
// tests/pet-spec.test.ts
import { describe, expect, it } from "vitest";
import { PET_SPEC, STATE_NAMES, cellFor, weaponVisibleFor } from "../src/pet-spec.js";

describe("Codex Pet v2 contract", () => {
  it("uses the exact native grid", () => {
    expect(PET_SPEC).toMatchObject({
      version: 2,
      columns: 8,
      rows: 11,
      cellWidth: 192,
      cellHeight: 208,
      sheetWidth: 1536,
      sheetHeight: 2288,
    });
  });

  it("maps every native animation row", () => {
    expect(STATE_NAMES).toEqual([
      "idle", "running-right", "running-left", "waving", "jumping",
      "failed", "waiting", "running", "review",
    ]);
    expect(cellFor("review", 5)).toEqual({ left: 960, top: 1664 });
  });

  it("enforces the approved weapon rule", () => {
    expect(weaponVisibleFor("idle")).toBe(false);
    expect(weaponVisibleFor("waiting")).toBe(false);
    expect(weaponVisibleFor("review")).toBe(false);
    expect(weaponVisibleFor("jumping")).toBe(false);
    expect(weaponVisibleFor("running")).toBe(true);
    expect(weaponVisibleFor("running-left")).toBe(true);
    expect(weaponVisibleFor("running-right")).toBe(true);
    expect(weaponVisibleFor("waving")).toBe(true);
    expect(weaponVisibleFor("failed")).toBe(true);
  });
});
```

- [ ] **Step 2: Add the package and TypeScript configuration**

```json
// package.json
{
  "name": "codex-blueflame-pet",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "build:pet": "tsx src/cli.ts build",
    "validate:pet": "tsx src/cli.ts validate",
    "install:pet": "tsx src/cli.ts install",
    "preview": "vite --host 127.0.0.1",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "sharp": "^0.34.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.54.0",
    "@types/node": "^22.0.0",
    "tsx": "^4.20.0",
    "typescript": "^5.8.0",
    "vite": "^7.0.0",
    "vitest": "^3.2.0"
  }
}
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "outDir": "dist-js",
    "types": ["node", "vitest/globals"]
  },
  "include": ["src", "tests", "preview"]
}
```

- [ ] **Step 3: Install dependencies and verify the test fails**

Run: `npm install && npm test -- tests/pet-spec.test.ts`

Expected: FAIL because `src/pet-spec.ts` does not exist.

- [ ] **Step 4: Implement the native grid contract**

```ts
// src/pet-spec.ts
export const PET_SPEC = {
  version: 2,
  columns: 8,
  rows: 11,
  cellWidth: 192,
  cellHeight: 208,
  sheetWidth: 1536,
  sheetHeight: 2288,
} as const;

export const STATES = {
  idle: { row: 0, frames: 6, weapon: false },
  "running-right": { row: 1, frames: 8, weapon: true },
  "running-left": { row: 2, frames: 8, weapon: true },
  waving: { row: 3, frames: 4, weapon: true },
  jumping: { row: 4, frames: 5, weapon: false },
  failed: { row: 5, frames: 8, weapon: true },
  waiting: { row: 6, frames: 6, weapon: false },
  running: { row: 7, frames: 6, weapon: true },
  review: { row: 8, frames: 6, weapon: false },
} as const;

export type StateName = keyof typeof STATES;
export const STATE_NAMES = Object.keys(STATES) as StateName[];

export function cellFor(state: StateName, column: number) {
  if (!Number.isInteger(column) || column < 0 || column >= PET_SPEC.columns) {
    throw new RangeError(`column must be 0-${PET_SPEC.columns - 1}`);
  }
  return {
    left: column * PET_SPEC.cellWidth,
    top: STATES[state].row * PET_SPEC.cellHeight,
  };
}

export function weaponVisibleFor(state: StateName) {
  return STATES[state].weapon;
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test -- tests/pet-spec.test.ts && npm run typecheck`

Expected: PASS, 3 tests; TypeScript exits 0.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json src/pet-spec.ts tests/pet-spec.test.ts
git commit -m "feat: define Codex Pet v2 asset contract"
```

---

### Task 2: Validate source frames before composition

**Files:**
- Create: `src/validate-frame.ts`
- Create: `tests/validate-frame.test.ts`
- Create: `tests/fixtures/` through the test setup

**Interfaces:**
- Consumes: `PET_SPEC` from Task 1.
- Produces: `validateFrame(path): Promise<FrameValidation>` and `assertFrame(path): Promise<void>`.

- [ ] **Step 1: Write failing tests for size and transparency**

```ts
// tests/validate-frame.test.ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { mkdir, rm } from "node:fs/promises";
import { validateFrame } from "../src/validate-frame.js";

const root = "tests/fixtures/generated";

beforeAll(async () => {
  await mkdir(root, { recursive: true });
  await sharp({ create: { width: 192, height: 208, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .png().toFile(`${root}/valid.png`);
  await sharp({ create: { width: 191, height: 208, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .png().toFile(`${root}/wrong-size.png`);
  await sharp({ create: { width: 192, height: 208, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .png().toFile(`${root}/opaque.png`);
});

afterAll(() => rm(root, { recursive: true, force: true }));

describe("validateFrame", () => {
  it("accepts a transparent 192x208 PNG", async () => {
    expect(await validateFrame(`${root}/valid.png`)).toEqual({ ok: true, errors: [] });
  });
  it("rejects wrong geometry", async () => {
    expect((await validateFrame(`${root}/wrong-size.png`)).errors).toContain("expected 192x208, got 191x208");
  });
  it("rejects a frame without alpha", async () => {
    expect((await validateFrame(`${root}/opaque.png`)).errors).toContain("frame must have an alpha channel");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- tests/validate-frame.test.ts`

Expected: FAIL because `validateFrame` is missing.

- [ ] **Step 3: Implement strict frame validation**

```ts
// src/validate-frame.ts
import sharp from "sharp";
import { PET_SPEC } from "./pet-spec.js";

export type FrameValidation = { ok: boolean; errors: string[] };

export async function validateFrame(path: string): Promise<FrameValidation> {
  const metadata = await sharp(path).metadata();
  const errors: string[] = [];
  if (metadata.format !== "png") errors.push(`expected PNG, got ${metadata.format ?? "unknown"}`);
  if (metadata.width !== PET_SPEC.cellWidth || metadata.height !== PET_SPEC.cellHeight) {
    errors.push(`expected ${PET_SPEC.cellWidth}x${PET_SPEC.cellHeight}, got ${metadata.width ?? 0}x${metadata.height ?? 0}`);
  }
  if (!metadata.hasAlpha) errors.push("frame must have an alpha channel");
  return { ok: errors.length === 0, errors };
}

export async function assertFrame(path: string): Promise<void> {
  const result = await validateFrame(path);
  if (!result.ok) throw new Error(`${path}: ${result.errors.join("; ")}`);
}
```

- [ ] **Step 4: Run the focused and full tests**

Run: `npm test -- tests/validate-frame.test.ts && npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/validate-frame.ts tests/validate-frame.test.ts
git commit -m "feat: validate Codex Pet source frames"
```

---

### Task 3: Create and approve the immutable character master

**Files:**
- Create: `assets/references/IMG_2189.JPG`
- Create: `assets/references/IMG_2188.JPG`
- Create: `assets/references/IMG_2190.PNG`
- Create: `assets/master/blueflame-master.png`
- Create: `assets/master/character-lock.json`

**Interfaces:**
- Produces: the only approved visual reference for all animation frames and a machine-readable lock file.

- [ ] **Step 1: Copy the three supplied references into the project**

Run:

```bash
mkdir -p assets/references assets/master
cp /Users/mars/Downloads/IMG_2189.JPG assets/references/
cp /Users/mars/Downloads/IMG_2188.JPG assets/references/
cp /Users/mars/Downloads/IMG_2190.PNG assets/references/
```

Expected: three reference files exist and `shasum -a 256 assets/references/*` prints three hashes.

- [ ] **Step 2: Generate the full-body master with ImageGen**

Use all three references and this exact art direction:

```text
Create one original full-body anime character turnaround hero image on a transparent background. The character must be visible from the top of both twin-tails to the soles of both boots, with generous transparent padding and no cropping. Use a normal seven-head adult anime proportion, not chibi. Stay very close to the supplied illustrated references: black high twin-tails with side fringe, ice-blue eyes, a small blue flame above the viewer-right eye (character anatomical left), cropped black hooded jacket with white sleeve stripes and a white star emblem, black shorts, white belt, black gloves, and knee-high black tactical boots. Resolve inconsistencies between the references into one coherent outfit. Smooth polished cel-shaded anime rendering with clean dark outlines, restrained blue highlights, neutral standing pose, cool reserved expression with a subtle cute undertone. Also show the complete separate weapon beside her: one long black katana-like sword with a silver-blue cutting edge, based only on the weapon cue in the live-action reference. No text, no scenery, no extra character, no missing limbs, no cropped hair, no cropped boots, no sexualized pose.
```

Save the chosen output as `assets/master/blueflame-master.png`.

- [ ] **Step 3: Review the master at native and reduced sizes**

Run:

```bash
mkdir -p work/master-review
npx tsx -e 'import sharp from "sharp"; await sharp("assets/master/blueflame-master.png").resize(224,224,{fit:"contain",background:{r:0,g:0,b:0,alpha:0}}).png().toFile("work/master-review/master-224.png")'
npx tsx -e 'import sharp from "sharp"; await sharp("assets/master/blueflame-master.png").resize(80,80,{fit:"contain",background:{r:0,g:0,b:0,alpha:0}}).png().toFile("work/master-review/master-80.png")'
```

Expected: full hair, both hands, both boots, and the complete separate sword remain inside the image; at 80 px the eyes, blue flame, twin-tail silhouette, torso, legs, and boots remain distinguishable.

- [ ] **Step 4: Ask the user to approve the displayed master**

Display `assets/master/blueflame-master.png`, `work/master-review/master-224.png`, and `work/master-review/master-80.png`. Do not create state frames until the user explicitly approves the master.

- [ ] **Step 5: Record the approved character lock**

```json
// assets/master/character-lock.json
{
  "name": "BLACK★ROCK SHOOTER",
  "proportion": "seven-head adult anime",
  "renderStyle": "smooth cel-shaded anime",
  "hair": "black high twin-tails with side fringe",
  "eyes": "ice blue",
  "flame": "small blue flame above viewer-right eye (character anatomical left)",
  "jacket": "cropped black hooded jacket, white sleeve stripes, white star emblem",
  "bottom": "black shorts with white belt",
  "hands": "black gloves",
  "boots": "knee-high black tactical boots",
  "weapon": "long black katana-like sword with silver-blue edge",
  "personality": "cool exterior, subtly cute reactions",
  "master": "blueflame-master.png"
}
```

- [ ] **Step 6: Commit the approved master**

```bash
git add assets/references assets/master
git commit -m "art: lock BLACK★ROCK SHOOTER character master"
```

---

### Task 4: Produce all native state frames from the approved master

**Files:**
- Create: `assets/frames/idle/0.png` through `5.png`
- Create: `assets/frames/running-right/0.png` through `7.png`
- Create: `assets/frames/running-left/0.png` through `7.png`
- Create: `assets/frames/waving/0.png` through `3.png`
- Create: `assets/frames/jumping/0.png` through `4.png`
- Create: `assets/frames/failed/0.png` through `7.png`
- Create: `assets/frames/waiting/0.png` through `5.png`
- Create: `assets/frames/running/0.png` through `5.png`
- Create: `assets/frames/review/0.png` through `5.png`
- Create: `assets/frames/look/0.png` through `15.png`
- Create: `assets/frames/frame-review.md`

**Interfaces:**
- Consumes: `assets/master/blueflame-master.png` and `character-lock.json`.
- Produces: 73 validated `192 × 208` transparent PNG frames.

- [ ] **Step 1: Create the complete frame directories**

Run:

```bash
mkdir -p assets/frames/{idle,running-right,running-left,waving,jumping,failed,waiting,running,review,look}
```

- [ ] **Step 2: Generate state keyframes from the master**

For every state, use the approved master as the referenced image and preserve character identity exactly. Apply this shared instruction to every generation:

```text
Use the attached approved BLACK★ROCK SHOOTER master as an immutable character reference. Preserve the same face, seven-head body ratio, hair length, twin-tail anchors, outfit seams, star emblem, belt, gloves, boots, colors, cel-shading, and sword design. Draw the complete body from hair tips to boot soles inside a 192x208 transparent frame with consistent foot baseline and scale. No scenery, text, extra limbs, cropping, outfit changes, face changes, or camera changes.
```

Generate these exact action arcs:

- `idle`, 6 frames: neutral cold stance; blink; tiny twin-tail and jacket sway; no sword.
- `running-right`, 8 frames: complete body dashes right while holding the full sword; blue flame streams left.
- `running-left`, 8 frames: authored leftward dash, not a mirrored image; star emblem and sword grip remain anatomically correct.
- `waving`, 4 frames: sword appears, one compact flourish, sword vanishes after sheathing, subtle smile.
- `jumping`, 5 frames: surprised small hop from click interaction, then embarrassed recovery; no sword.
- `failed`, 8 frames: sword appears planted tip-down, character lowers to one knee, flame dims; no injury or gore.
- `waiting`, 6 frames: arms folded, impatient look, one head tilt and blink; no sword.
- `running`, 6 frames: draws sword and holds ready combat stance, blue flame brightens.
- `review`, 6 frames: inspects a small translucent blue code pane, then nods; no sword.
- `look`, 16 frames: neutral idle body with gaze/head direction every 22.5 degrees starting at up, clockwise; no sword.

Normalize every accepted frame to exactly `192 × 208` transparent PNG and save with the paths above.

- [ ] **Step 3: Validate all generated frames**

Run:

```bash
npx tsx -e 'import { assertFrame } from "./src/validate-frame.ts"; import { STATES } from "./src/pet-spec.ts"; import { join } from "node:path"; let count=0; for (const [state,spec] of Object.entries(STATES)) for (let column=0; column<spec.frames; column+=1) { await assertFrame(join("assets/frames",state,`${column}.png`)); count+=1; } for (let direction=0; direction<16; direction+=1) { await assertFrame(join("assets/frames","look",`${direction}.png`)); count+=1; } console.log(`${count} frames valid; 0 errors`)'
```

Expected: `73 frames valid; 0 errors`.

- [ ] **Step 4: Create a contact sheet and review consistency**

Run this self-contained compositor before the Task 7 CLI exists, then inspect `work/frame-review/contact-sheet.png`:

```bash
npx tsx -e 'import sharp from "sharp"; import { mkdir } from "node:fs/promises"; import { STATES } from "./src/pet-spec.ts"; import { join } from "node:path"; const overlays=[]; for (const [state,spec] of Object.entries(STATES)) for (let column=0; column<spec.frames; column+=1) overlays.push({input:join("assets/frames",state,`${column}.png`),left:column*192,top:spec.row*208}); for (let direction=0; direction<16; direction+=1) overlays.push({input:join("assets/frames","look",`${direction}.png`),left:(direction%8)*192,top:(9+Math.floor(direction/8))*208}); await mkdir("work/frame-review",{recursive:true}); await sharp({create:{width:1536,height:2288,channels:4,background:{r:28,g:31,b:38,alpha:1}}}).composite(overlays).png().toFile("work/frame-review/contact-sheet.png")'
```

Record checks in:

```md
# Frame review

- [x] Same face and eye color in all 73 frames
- [x] Same seven-head body ratio and foot baseline
- [x] Same jacket, star, belt, gloves, shorts, and boots
- [x] Full body visible in every frame
- [x] Full sword visible only in approved weapon states
- [x] Left and right movement are authored correctly
- [x] Transparent edges are clean
- [x] No frame-to-frame scale jumps
```

- [ ] **Step 5: Commit the reviewed frames**

```bash
git add assets/frames
git commit -m "art: add BLACK★ROCK SHOOTER native state frames"
```

---

### Task 5: Assemble and validate the Codex v2 spritesheet

**Files:**
- Create: `src/assemble-spritesheet.ts`
- Create: `tests/assemble-spritesheet.test.ts`
- Create: `dist/blueflame/spritesheet.webp`

**Interfaces:**
- Consumes: `PET_SPEC`, `STATES`, and validated PNG frames.
- Produces: `assembleSpritesheet(frameRoot, outputPath): Promise<void>`.

- [ ] **Step 1: Write a failing assembly test**

```ts
// tests/assemble-spritesheet.test.ts
import { afterEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { mkdir, rm } from "node:fs/promises";
import { assembleSpritesheet } from "../src/assemble-spritesheet.js";

const root = "tests/fixtures/sheet";

afterEach(() => rm(root, { recursive: true, force: true }));

describe("assembleSpritesheet", () => {
  it("writes the exact v2 canvas with alpha", async () => {
    await mkdir(`${root}/idle`, { recursive: true });
    const frame = await sharp({ create: { width: 192, height: 208, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 1 } } }).png().toBuffer();
    for (let index = 0; index < 6; index += 1) await sharp(frame).toFile(`${root}/idle/${index}.png`);
    await assembleSpritesheet(root, `${root}/out.webp`, { allowMissingStates: true });
    const metadata = await sharp(`${root}/out.webp`).metadata();
    expect(metadata).toMatchObject({ width: 1536, height: 2288, format: "webp", hasAlpha: true });
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- tests/assemble-spritesheet.test.ts`

Expected: FAIL because `assembleSpritesheet` is missing.

- [ ] **Step 3: Implement deterministic grid composition**

```ts
// src/assemble-spritesheet.ts
import sharp from "sharp";
import { access, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PET_SPEC, STATES } from "./pet-spec.js";
import { assertFrame } from "./validate-frame.js";

type Options = { allowMissingStates?: boolean };

export async function assembleSpritesheet(frameRoot: string, outputPath: string, options: Options = {}) {
  const composites: sharp.OverlayOptions[] = [];
  for (const [state, spec] of Object.entries(STATES)) {
    for (let column = 0; column < spec.frames; column += 1) {
      const input = join(frameRoot, state, `${column}.png`);
      try { await access(input); } catch {
        if (options.allowMissingStates) continue;
        throw new Error(`missing frame: ${input}`);
      }
      await assertFrame(input);
      composites.push({ input, left: column * PET_SPEC.cellWidth, top: spec.row * PET_SPEC.cellHeight });
    }
  }
  for (let direction = 0; direction < 16; direction += 1) {
    const input = join(frameRoot, "look", `${direction}.png`);
    try { await access(input); } catch {
      if (options.allowMissingStates) continue;
      throw new Error(`missing look frame: ${input}`);
    }
    await assertFrame(input);
    composites.push({
      input,
      left: (direction % 8) * PET_SPEC.cellWidth,
      top: (9 + Math.floor(direction / 8)) * PET_SPEC.cellHeight,
    });
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await sharp({ create: { width: PET_SPEC.sheetWidth, height: PET_SPEC.sheetHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites)
    .webp({ lossless: true, effort: 6 })
    .toFile(outputPath);
}
```

- [ ] **Step 4: Run tests and assemble the real sheet**

Run:

```bash
npm test -- tests/assemble-spritesheet.test.ts
npx tsx -e 'import { assembleSpritesheet } from "./src/assemble-spritesheet.ts"; await assembleSpritesheet("assets/frames", "dist/blueflame/spritesheet.webp")'
```

Expected: test PASS; `file dist/blueflame/spritesheet.webp` reports WebP; Sharp metadata reports `1536x2288` and alpha.

- [ ] **Step 5: Commit**

```bash
git add src/assemble-spritesheet.ts tests/assemble-spritesheet.test.ts dist/blueflame/spritesheet.webp
git commit -m "feat: assemble BLACK★ROCK SHOOTER v2 spritesheet"
```

---

### Task 6: Generate the manifest and install atomically

**Files:**
- Create: `src/manifest.ts`
- Create: `src/install-pet.ts`
- Create: `tests/manifest.test.ts`
- Create: `tests/install-pet.test.ts`
- Create: `dist/blueflame/pet.json`

**Interfaces:**
- Produces: `createManifest()`, `writeManifest(path)`, and `installPet({ sourceDir, petsRoot, slug })`.

- [ ] **Step 1: Write failing manifest and installer tests**

```ts
// tests/manifest.test.ts
import { expect, it } from "vitest";
import { createManifest } from "../src/manifest.js";

it("creates the native v2 manifest", () => {
  expect(createManifest()).toEqual({
    displayName: "BLACK★ROCK SHOOTER",
    description: "A cool-headed blue-flame swordswoman who tracks your Codex tasks.",
    spriteVersionNumber: 2,
    spritesheetPath: "spritesheet.webp",
  });
});
```

```ts
// tests/install-pet.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { installPet } from "../src/install-pet.js";

const root = "tests/fixtures/install";
afterEach(() => rm(root, { recursive: true, force: true }));

describe("installPet", () => {
  it("replaces only its own slug and keeps a backup", async () => {
    await mkdir(`${root}/source`, { recursive: true });
    await mkdir(`${root}/pets/blueflame`, { recursive: true });
    await mkdir(`${root}/pets/other-pet`, { recursive: true });
    await writeFile(`${root}/source/pet.json`, "new");
    await writeFile(`${root}/source/spritesheet.webp`, "sheet");
    await writeFile(`${root}/pets/blueflame/pet.json`, "old");
    await writeFile(`${root}/pets/other-pet/keep`, "safe");
    const result = await installPet({ sourceDir: `${root}/source`, petsRoot: `${root}/pets`, slug: "blueflame", validate: async () => undefined });
    expect(await readFile(`${root}/pets/blueflame/pet.json`, "utf8")).toBe("new");
    expect(await readFile(`${root}/pets/other-pet/keep`, "utf8")).toBe("safe");
    expect(result.backupPath).toContain("blueflame.backup-");
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/manifest.test.ts tests/install-pet.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement the manifest**

```ts
// src/manifest.ts
import { writeFile } from "node:fs/promises";

export function createManifest() {
  return {
    displayName: "BLACK★ROCK SHOOTER",
    description: "A cool-headed blue-flame swordswoman who tracks your Codex tasks.",
    spriteVersionNumber: 2,
    spritesheetPath: "spritesheet.webp",
  } as const;
}

export async function writeManifest(path: string) {
  await writeFile(path, `${JSON.stringify(createManifest(), null, 2)}\n`, "utf8");
}
```

- [ ] **Step 4: Implement staging, backup, and atomic replacement**

```ts
// src/install-pet.ts
import { cp, mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";

type InstallOptions = {
  sourceDir: string;
  petsRoot: string;
  slug: string;
  validate: (directory: string) => Promise<void>;
};

export async function installPet(options: InstallOptions) {
  const target = join(options.petsRoot, options.slug);
  const staging = join(options.petsRoot, `.${options.slug}.staging`);
  const backup = join(options.petsRoot, `${options.slug}.backup-${Date.now()}`);
  await mkdir(options.petsRoot, { recursive: true });
  await rm(staging, { recursive: true, force: true });
  await cp(options.sourceDir, staging, { recursive: true });
  await options.validate(staging);
  let backupPath: string | null = null;
  try {
    await rename(target, backup);
    backupPath = backup;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  try {
    await rename(staging, target);
  } catch (error) {
    if (backupPath) await rename(backupPath, target);
    throw error;
  }
  return { target, backupPath };
}
```

- [ ] **Step 5: Run tests and generate the real manifest**

Run:

```bash
npm test -- tests/manifest.test.ts tests/install-pet.test.ts
npx tsx -e 'import { writeManifest } from "./src/manifest.ts"; await writeManifest("dist/blueflame/pet.json")'
```

Expected: tests PASS; `dist/blueflame/pet.json` matches the approved manifest.

- [ ] **Step 6: Commit**

```bash
git add src/manifest.ts src/install-pet.ts tests/manifest.test.ts tests/install-pet.test.ts dist/blueflame/pet.json
git commit -m "feat: install BLACK★ROCK SHOOTER Pet atomically"
```

---

### Task 7: Add the CLI and contact-sheet review command

**Files:**
- Create: `src/cli.ts`
- Create: `src/contact-sheet.ts`
- Create: `tests/cli.test.ts`

**Interfaces:**
- Consumes: validators, assembler, manifest, and installer.
- Produces: `npm run validate:pet`, `npm run build:pet`, `npm run install:pet`, and `tsx src/cli.ts contact-sheet`.

- [ ] **Step 1: Write a failing CLI behavior test**

```ts
// tests/cli.test.ts
import { expect, it } from "vitest";
import { parseCommand } from "../src/cli.js";

it("accepts only supported commands", () => {
  expect(parseCommand(["build"])).toBe("build");
  expect(parseCommand(["validate"])).toBe("validate");
  expect(parseCommand(["install"])).toBe("install");
  expect(parseCommand(["contact-sheet"])).toBe("contact-sheet");
  expect(() => parseCommand(["delete"])).toThrow("unknown command: delete");
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- tests/cli.test.ts`

Expected: FAIL because `parseCommand` does not exist.

- [ ] **Step 3: Implement the contact sheet**

```ts
// src/contact-sheet.ts
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PET_SPEC, STATES } from "./pet-spec.js";

export async function createContactSheet(frameRoot: string, outputPath: string) {
  const width = PET_SPEC.columns * PET_SPEC.cellWidth;
  const rows = 11;
  const overlays: sharp.OverlayOptions[] = [];
  for (const [state, spec] of Object.entries(STATES)) {
    for (let column = 0; column < spec.frames; column += 1) {
      overlays.push({ input: join(frameRoot, state, `${column}.png`), left: column * 192, top: spec.row * 208 });
    }
  }
  for (let direction = 0; direction < 16; direction += 1) {
    overlays.push({ input: join(frameRoot, "look", `${direction}.png`), left: (direction % 8) * 192, top: (9 + Math.floor(direction / 8)) * 208 });
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await sharp({ create: { width, height: rows * 208, channels: 4, background: { r: 28, g: 31, b: 38, alpha: 1 } } })
    .composite(overlays).png().toFile(outputPath);
}
```

- [ ] **Step 4: Implement the CLI orchestration**

```ts
// src/cli.ts
import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { assembleSpritesheet } from "./assemble-spritesheet.js";
import { createContactSheet } from "./contact-sheet.js";
import { installPet } from "./install-pet.js";
import { writeManifest } from "./manifest.js";
import { PET_SPEC, STATES } from "./pet-spec.js";
import { assertFrame } from "./validate-frame.js";

const commands = ["validate", "build", "install", "contact-sheet"] as const;
type Command = typeof commands[number];

export function parseCommand(args: string[]): Command {
  const command = args[0];
  if (!commands.includes(command as Command)) throw new Error(`unknown command: ${command ?? "missing"}`);
  return command as Command;
}

export async function validateAll(frameRoot = "assets/frames") {
  let count = 0;
  for (const [state, spec] of Object.entries(STATES)) {
    for (let column = 0; column < spec.frames; column += 1) {
      await assertFrame(join(frameRoot, state, `${column}.png`)); count += 1;
    }
  }
  for (let direction = 0; direction < 16; direction += 1) {
    await assertFrame(join(frameRoot, "look", `${direction}.png`)); count += 1;
  }
  return count;
}

async function validateBuild(directory: string) {
  const manifest = JSON.parse(await readFile(join(directory, "pet.json"), "utf8"));
  if (manifest.spriteVersionNumber !== 2 || manifest.spritesheetPath !== "spritesheet.webp") throw new Error("invalid pet.json");
  const metadata = await sharp(join(directory, "spritesheet.webp")).metadata();
  if (metadata.width !== PET_SPEC.sheetWidth || metadata.height !== PET_SPEC.sheetHeight || !metadata.hasAlpha) throw new Error("invalid spritesheet.webp");
}

async function main() {
  const command = parseCommand(process.argv.slice(2));
  if (command === "validate") { console.log(`${await validateAll()} frames valid; 0 errors`); return; }
  if (command === "contact-sheet") { await createContactSheet("assets/frames", "work/frame-review/contact-sheet.png"); return; }
  if (command === "build") {
    await validateAll();
    await assembleSpritesheet("assets/frames", "dist/blueflame/spritesheet.webp");
    await writeManifest("dist/blueflame/pet.json");
    await validateBuild("dist/blueflame");
    return;
  }
  await validateBuild("dist/blueflame");
  const petsRoot = join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "pets");
  const result = await installPet({ sourceDir: "dist/blueflame", petsRoot, slug: "blueflame", validate: validateBuild });
  console.log(`Installed to ${result.target}`);
}

if (process.argv[1]?.endsWith("cli.ts")) main().catch(error => { console.error(error); process.exitCode = 1; });
```

- [ ] **Step 5: Run all CLI tests and commands**

Run:

```bash
npm test -- tests/cli.test.ts
npm run validate:pet
npm run build:pet
npx tsx src/cli.ts contact-sheet
```

Expected: test PASS; validation prints `73 frames valid; 0 errors`; build exits 0; contact sheet exists.

- [ ] **Step 6: Commit**

```bash
git add src/cli.ts src/contact-sheet.ts tests/cli.test.ts work/frame-review/contact-sheet.png
git commit -m "feat: add BLACK★ROCK SHOOTER build and review CLI"
```

---

### Task 8: Preview native animation and size behavior

**Files:**
- Create: `preview/index.html`
- Create: `preview/main.ts`
- Create: `tests/preview.spec.ts`
- Create: `playwright.config.ts`

**Interfaces:**
- Consumes: `dist/blueflame/spritesheet.webp` and the native state map.
- Produces: browser evidence for all states and the 80–224 px size range.

- [ ] **Step 1: Write the failing Playwright test**

```ts
// tests/preview.spec.ts
import { expect, test } from "@playwright/test";

test("switches states and reproduces the native size slider", async ({ page }) => {
  await page.goto("/preview/");
  const pet = page.getByTestId("pet");
  await expect(pet).toHaveAttribute("data-state", "idle");
  await page.getByLabel("State").selectOption("failed");
  await expect(pet).toHaveAttribute("data-state", "failed");
  await page.getByLabel("Pet size").fill("80");
  await expect(pet).toHaveCSS("width", "80px");
  await page.getByLabel("Pet size").fill("224");
  await expect(pet).toHaveCSS("width", "224px");
});
```

- [ ] **Step 2: Add Playwright configuration**

```ts
// playwright.config.ts
import { defineConfig } from "@playwright/test";
export default defineConfig({
  webServer: { command: "npm run preview", port: 5173, reuseExistingServer: true },
  use: { baseURL: "http://127.0.0.1:5173" },
});
```

- [ ] **Step 3: Run the E2E test and verify it fails**

Run: `npm run test:e2e -- tests/preview.spec.ts`

Expected: FAIL because the preview does not exist.

- [ ] **Step 4: Implement the preview shell**

```html
<!-- preview/index.html -->
<!doctype html>
<html><body style="margin:0;background:#1c1f26;color:white;font-family:system-ui">
  <main style="display:grid;gap:20px;padding:24px">
    <label>State <select id="state" aria-label="State"></select></label>
    <label>Pet size <input id="size" aria-label="Pet size" type="range" min="80" max="224" value="113"></label>
    <div id="pet" data-testid="pet" data-state="idle"></div>
  </main>
  <script type="module" src="/preview/main.ts"></script>
</body></html>
```

```ts
// preview/main.ts
import { STATES, type StateName } from "../src/pet-spec.js";

const pet = document.querySelector<HTMLDivElement>("#pet")!;
const state = document.querySelector<HTMLSelectElement>("#state")!;
const size = document.querySelector<HTMLInputElement>("#size")!;

for (const name of Object.keys(STATES) as StateName[]) state.add(new Option(name, name));
pet.style.cssText = "aspect-ratio:192/208;background-image:url('/dist/blueflame/spritesheet.webp');background-size:800% 1100%;background-repeat:no-repeat;image-rendering:pixelated;width:113px";

let timer = 0;
function play(name: StateName) {
  window.clearInterval(timer);
  pet.dataset.state = name;
  let frame = 0;
  const spec = STATES[name];
  const paint = () => {
    pet.style.backgroundPosition = `${frame / 7 * 100}% ${spec.row / 10 * 100}%`;
    frame = (frame + 1) % spec.frames;
  };
  paint(); timer = window.setInterval(paint, 160);
}
state.addEventListener("change", () => play(state.value as StateName));
size.addEventListener("input", () => { pet.style.width = `${size.value}px`; });
play("idle");
```

- [ ] **Step 5: Run browser verification at all required sizes**

Run: `npm run test:e2e -- tests/preview.spec.ts`

Expected: PASS. Then capture screenshots for all nine states at 80, 113, and 224 px into `work/preview-evidence/` and inspect for cropping, white edges, unreadable silhouettes, or weapon-rule violations.

- [ ] **Step 6: Commit**

```bash
git add preview tests/preview.spec.ts playwright.config.ts work/preview-evidence
git commit -m "test: verify BLACK★ROCK SHOOTER states and native size range"
```

---

### Task 9: Install into Codex and perform final acceptance

**Files:**
- Modify: `assets/frames/frame-review.md`
- Create: `docs/verification/2026-07-17-blueflame-pet.md`

**Interfaces:**
- Consumes: the validated `dist/blueflame` package and installer.
- Produces: an installed native Pet and final evidence report.

- [ ] **Step 1: Run the complete local verification suite**

Run:

```bash
npm run typecheck
npm test
npm run validate:pet
npm run build:pet
npm run test:e2e
git diff --check
```

Expected: every command exits 0; validation reports 73 frames.

- [ ] **Step 2: Install without touching other Pets**

Run: `npm run install:pet`

Expected: output begins `Installed to` and ends with `/.codex/pets/blueflame`. The directory contains only `pet.json` and `spritesheet.webp`; existing sibling Pet directories are unchanged.

- [ ] **Step 3: Verify in Codex Settings**

Open `Settings → Pets`, click `Refresh`, select `BLACK★ROCK SHOOTER`, and click `Wake Pet`. Verify that the Pet appears in the native selector and floating overlay. This UI verification requires the user because Codex blocks Computer Use from controlling its own app.

- [ ] **Step 4: Verify real task-state transitions**

Run one harmless task that reads a file, one task that waits for user input, one successful task, and one intentionally failing harmless command. Confirm that the Pet visibly transitions through `running`, `waiting`, `review`, and `failed`, with the approved weapon rules.

- [ ] **Step 5: Verify the native size slider**

Move `Pet size` to 80 px, default, and 224 px. Confirm the complete body remains visible; the blue flame, twin-tail silhouette, legs, boots, and state action remain readable; no white fringe appears. Restart Codex and confirm the chosen size persists.

- [ ] **Step 6: Record final evidence**

```md
# BLACK★ROCK SHOOTER Pet verification — 2026-07-17

- Typecheck: pass
- Unit tests: pass
- Frame validation: 73/73
- Browser state preview: pass
- Installed path: ~/.codex/pets/blueflame
- Settings selector: pass
- Running / waiting / review / failed transitions: pass
- Weapon visibility rules: pass
- 80 / default / 224 px size checks: pass
- Size persists after restart: pass
- Other custom Pets unchanged: pass
```

- [ ] **Step 7: Commit the evidence**

```bash
git add docs/verification/2026-07-17-blueflame-pet.md assets/frames/frame-review.md
git commit -m "docs: verify BLACK★ROCK SHOOTER Pet end to end"
```

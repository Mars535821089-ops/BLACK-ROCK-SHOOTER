import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { analyzePixelQa, PIXEL_QA_THRESHOLDS } from "../src/pixel-qa.ts";
import { STATE_NAMES } from "../src/pet-spec.ts";

const outputRoot = "work/task-10/after";
const evidenceRoot = join(outputRoot, "pixel-qa");
const byFile = {};
const sizes = [80, 113, 224];
for (const size of sizes) {
  for (const state of STATE_NAMES) {
    const path = join(evidenceRoot, `${state}-${size}.png`);
    byFile[`${state}-${size}.png`] = await analyzePixelQa(path);
  }
}

const values = Object.values(byFile);
const total = (key) => values.reduce((sum, result) => sum + result[key], 0);
const result = {
  method: {
    region: "transparent-background Playwright pet-element screenshot; only sprite pixels with alpha >= 9 are occupied",
    thresholds: PIXEL_QA_THRESHOLDS,
    greenCandidate: "g > r + 25 and g > b + 20",
    lowAlphaBrightCandidate: "alpha 9..229 and r,g,b >= 241; diagnostic count only because white hair, skin, emblem, and highlights are intentional",
  },
  screenshotCount: values.length,
  sizes,
  totals: {
    occupiedPixels: total("occupiedPixels"),
    greenDominantPixels: total("greenDominantPixels"),
    lowAlphaBrightPixels: total("lowAlphaBrightPixels"),
    opaqueGreenPixels: values.reduce(
      (sum, item) => sum + item.greenAlphaBins.alpha129To255,
      0,
    ),
  },
  byFile,
};

await mkdir(outputRoot, { recursive: true });
await copyFile("work/frame-review/contact-sheet.png", join(outputRoot, "contact-sheet-native.png"));
await copyFile("work/preview-evidence/preview-workbench.png", join(outputRoot, "preview-workbench.png"));
await writeFile(join(outputRoot, "preview-pixel-qa.json"), `${JSON.stringify(result, null, 2)}\n`);

if (result.totals.opaqueGreenPixels !== 0) {
  throw new Error(`preview pixel QA failed: ${JSON.stringify(result.totals)}`);
}
console.log(`preview pixel QA: ${values.length} screenshots; green candidates=${result.totals.greenDominantPixels}; opaque green=0; low-alpha bright candidates=${result.totals.lowAlphaBrightPixels}`);

import sharp from "sharp";
import { join } from "node:path";
import { expect, it } from "vitest";
import { analyzePixelQa } from "../src/pixel-qa.js";
import { STATE_NAMES } from "../src/pet-spec.js";

it("counts only occupied green and low-alpha white fringe candidates", async () => {
  const input = await sharp(Buffer.from([
    0, 255, 0, 0,
    0, 255, 0, 32,
    250, 250, 250, 64,
    20, 40, 90, 255,
  ]), { raw: { width: 4, height: 1, channels: 4 } })
    .png()
    .toBuffer();

  expect(await analyzePixelQa(input)).toMatchObject({
    occupiedPixels: 3,
    greenDominantPixels: 1,
    lowAlphaBrightPixels: 1,
    transparentRgbPixels: 1,
    greenAlphaBins: { alpha9To32: 1, alpha33To64: 0, alpha65To128: 0, alpha129To255: 0 },
  });
});

it("keeps the captured 80px, default 113px, and 224px preview evidence free of fringe candidates", async () => {
  const results = await Promise.all(
    [80, 113, 224].flatMap((size) =>
      STATE_NAMES.map((state) =>
        analyzePixelQa(join("work/task-10/after/pixel-qa", `${state}-${size}.png`)),
      ),
    ),
  );

  const opaqueGreen = results.reduce(
    (sum, result) => sum + result.greenAlphaBins.alpha129To255,
    0,
  );
  expect(opaqueGreen).toBe(0);
});

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, it } from "vitest";
import { STATE_NAMES, STATES } from "../src/pet-spec.js";
import { alphaBounds } from "../src/supersample-frame.js";
import { analyzePixelQa } from "../src/pixel-qa.js";

it("keeps all 73 supersampled animation frames visually distinct", async () => {
  const paths = STATE_NAMES.flatMap((state) =>
    Array.from({ length: STATES[state].frames }, (_, frame) =>
      join("assets/frames", state, `${frame}.png`),
    ),
  ).concat(
    Array.from({ length: 16 }, (_, direction) =>
      join("assets/frames/look", `${direction}.png`),
    ),
  );
  const hashes = await Promise.all(
    paths.map(async (path) =>
      createHash("sha256").update(await readFile(path)).digest("hex"),
    ),
  );

  expect(paths).toHaveLength(73);
  expect(new Set(hashes).size).toBe(73);
});

it("keeps at least four transparent pixels around every occupied frame", async () => {
  const paths = STATE_NAMES.flatMap((state) =>
    Array.from({ length: STATES[state].frames }, (_, frame) =>
      join("assets/frames", state, `${frame}.png`),
    ),
  ).concat(
    Array.from({ length: 16 }, (_, direction) =>
      join("assets/frames/look", `${direction}.png`),
    ),
  );
  const margins = await Promise.all(
    paths.map(async (path) => {
      const bounds = await alphaBounds(path);
      return Math.min(bounds.left, bounds.top, bounds.right, bounds.bottom);
    }),
  );

  expect(Math.min(...margins)).toBeGreaterThanOrEqual(4);
});

it("keeps native frame mattes free of green candidates and hidden transparent RGB", async () => {
  const paths = STATE_NAMES.flatMap((state) =>
    Array.from({ length: STATES[state].frames }, (_, frame) =>
      join("assets/frames", state, `${frame}.png`),
    ),
  ).concat(
    Array.from({ length: 16 }, (_, direction) =>
      join("assets/frames/look", `${direction}.png`),
    ),
  );
  const results = await Promise.all(paths.map((path) => analyzePixelQa(path)));

  expect(results.reduce((sum, result) => sum + result.greenDominantPixels, 0)).toBe(0);
  expect(results.reduce((sum, result) => sum + result.transparentRgbPixels, 0)).toBe(0);
});

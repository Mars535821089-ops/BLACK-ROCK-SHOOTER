import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, it } from "vitest";
import { STATE_NAMES, STATES } from "../src/pet-spec.js";

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

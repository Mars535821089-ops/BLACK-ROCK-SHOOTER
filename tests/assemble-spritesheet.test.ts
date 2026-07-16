import { afterEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { mkdir, rm } from "node:fs/promises";
import { assembleSpritesheet } from "../src/assemble-spritesheet.js";

const root = "tests/fixtures/sheet";

afterEach(() => rm(root, { recursive: true, force: true }));

describe("assembleSpritesheet", () => {
  it("writes the exact v2 canvas with alpha", async () => {
    await mkdir(`${root}/idle`, { recursive: true });
    const frame = await sharp({
      create: {
        width: 192,
        height: 208,
        channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    for (let index = 0; index < 6; index += 1) {
      await sharp(frame).toFile(`${root}/idle/${index}.png`);
    }
    await assembleSpritesheet(root, `${root}/out.webp`, {
      allowMissingStates: true,
    });
    const metadata = await sharp(`${root}/out.webp`).metadata();
    expect(metadata).toMatchObject({
      width: 1536,
      height: 2288,
      format: "webp",
      hasAlpha: true,
    });
  });
});

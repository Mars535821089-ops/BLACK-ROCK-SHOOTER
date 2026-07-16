import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { mkdir, rm } from "node:fs/promises";
import { validateFrame } from "../src/validate-frame.js";

const root = "tests/fixtures/generated";

beforeAll(async () => {
  await mkdir(root, { recursive: true });
  await sharp({
    create: {
      width: 192,
      height: 208,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toFile(`${root}/valid.png`);
  await sharp({
    create: {
      width: 191,
      height: 208,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toFile(`${root}/wrong-size.png`);
  await sharp({
    create: {
      width: 192,
      height: 208,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .png()
    .toFile(`${root}/opaque.png`);
});

afterAll(() => rm(root, { recursive: true, force: true }));

describe("validateFrame", () => {
  it("accepts a transparent 192x208 PNG", async () => {
    expect(await validateFrame(`${root}/valid.png`)).toEqual({
      ok: true,
      errors: [],
    });
  });

  it("rejects wrong geometry", async () => {
    expect((await validateFrame(`${root}/wrong-size.png`)).errors).toContain(
      "expected 192x208, got 191x208",
    );
  });

  it("rejects a frame without alpha", async () => {
    expect((await validateFrame(`${root}/opaque.png`)).errors).toContain(
      "frame must have an alpha channel",
    );
  });
});

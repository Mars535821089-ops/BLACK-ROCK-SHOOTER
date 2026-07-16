import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { mkdir, readFile, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { assembleSpritesheet } from "../src/assemble-spritesheet.js";

const root = "tests/fixtures/sheet";
const output = `${root}/out.webp`;
const cellWidth = 192;
const cellHeight = 208;

let sheetBytes: Buffer;
let sheetPixels: Buffer;
let sheetWidth: number;

async function writeSolidFrame(
  path: string,
  color: { r: number; g: number; b: number; alpha: number },
) {
  await mkdir(dirname(path), { recursive: true });
  await sharp({
    create: { width: cellWidth, height: cellHeight, channels: 4, background: color },
  })
    .png()
    .toFile(path);
}

function pixelAt(left: number, top: number) {
  const offset = (top * sheetWidth + left) * 4;
  return [...sheetPixels.subarray(offset, offset + 4)];
}

beforeAll(async () => {
  await rm(root, { recursive: true, force: true });

  const geometry = Buffer.alloc(cellWidth * cellHeight * 4);
  geometry.set([255, 0, 0, 255], 0);
  geometry.set([0, 255, 0, 255], (cellWidth * cellHeight - 1) * 4);
  await mkdir(`${root}/idle`, { recursive: true });
  await sharp(geometry, {
    raw: { width: cellWidth, height: cellHeight, channels: 4 },
  })
    .png()
    .toFile(`${root}/idle/0.png`);

  await writeSolidFrame(`${root}/jumping/2.png`, {
    r: 17,
    g: 34,
    b: 51,
    alpha: 1,
  });
  await writeSolidFrame(`${root}/look/7.png`, {
    r: 68,
    g: 85,
    b: 102,
    alpha: 1,
  });
  await writeSolidFrame(`${root}/look/8.png`, {
    r: 119,
    g: 136,
    b: 153,
    alpha: 1,
  });

  await assembleSpritesheet(root, output, { allowMissingStates: true });
  sheetBytes = await readFile(output);
  const { data, info } = await sharp(sheetBytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  sheetPixels = data;
  sheetWidth = info.width;
});

afterAll(() => rm(root, { recursive: true, force: true }));

describe("assembleSpritesheet", () => {
  it("writes the exact v2 canvas with alpha", async () => {
    const metadata = await sharp(sheetBytes).metadata();
    expect(metadata).toMatchObject({
      width: 1536,
      height: 2288,
      format: "webp",
      hasAlpha: true,
    });
  });

  it("rejects a production build with the exact missing frame path", async () => {
    const missingRoot = `${root}/missing`;
    const error = await assembleSpritesheet(
      missingRoot,
      `${root}/missing.webp`,
    ).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      `missing frame: ${missingRoot}/idle/0.png`,
    );
  });

  it("places a representative state frame in its configured grid cell", () => {
    expect(pixelAt(2 * cellWidth + 96, 4 * cellHeight + 104)).toEqual([
      17, 34, 51, 255,
    ]);
  });

  it("places look directions across rows 9 and 10", () => {
    expect(pixelAt(7 * cellWidth + 96, 9 * cellHeight + 104)).toEqual([
      68, 85, 102, 255,
    ]);
    expect(pixelAt(96, 10 * cellHeight + 104)).toEqual([
      119, 136, 153, 255,
    ]);
  });

  it("leaves unused cells transparent", () => {
    expect(pixelAt(7 * cellWidth + 96, 104)).toEqual([0, 0, 0, 0]);
  });

  it("encodes the sheet as lossless VP8L WebP", () => {
    expect(sheetBytes.indexOf(Buffer.from("VP8L"))).toBeGreaterThanOrEqual(12);
    expect(sheetBytes.indexOf(Buffer.from("VP8 "))).toBe(-1);
  });

  it("preserves native 192x208 geometry without resizing", () => {
    expect(pixelAt(0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(cellWidth - 1, cellHeight - 1)).toEqual([0, 255, 0, 255]);
    expect(pixelAt(cellWidth, cellHeight - 1)).toEqual([0, 0, 0, 0]);
  });
});

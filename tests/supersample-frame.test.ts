import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  FINAL_CELL,
  INTERMEDIATE_CELL,
  SUPERSAMPLE_FACTOR,
  alphaBounds,
  finalizeSupersampledFrame,
} from "../src/supersample-frame.js";

describe("supersampled frame finalization", () => {
  it("requires a true 4x 768x832 source and downsamples with safe transparent edges", async () => {
    expect(SUPERSAMPLE_FACTOR).toBe(4);
    expect(INTERMEDIATE_CELL).toEqual({ width: 768, height: 832 });

    const source = await sharp({
      create: {
        ...INTERMEDIATE_CELL,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="736" height="800"><rect width="736" height="800" fill="#157ed1"/></svg>',
          ),
          left: 16,
          top: 16,
        },
      ])
      .png()
      .toBuffer();

    const output = await finalizeSupersampledFrame(source);
    const metadata = await sharp(output).metadata();
    expect({ width: metadata.width, height: metadata.height }).toEqual(FINAL_CELL);
    expect(await alphaBounds(output)).toMatchObject({ left: 4, top: 4, right: 4, bottom: 4 });
  });

  it("rejects a native-size input so production cannot enlarge old frames", async () => {
    const native = await sharp({
      create: {
        ...FINAL_CELL,
        channels: 4,
        background: { r: 10, g: 20, b: 30, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    await expect(finalizeSupersampledFrame(native)).rejects.toThrow(
      "supersampled input must be exactly 768x832",
    );
  });
});

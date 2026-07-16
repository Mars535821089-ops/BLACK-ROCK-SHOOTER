import sharp from "sharp";
import { access, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PET_SPEC, STATES } from "./pet-spec.js";
import { assertFrame } from "./validate-frame.js";

type Options = { allowMissingStates?: boolean };

export async function assembleSpritesheet(
  frameRoot: string,
  outputPath: string,
  options: Options = {},
): Promise<void> {
  const composites: sharp.OverlayOptions[] = [];

  for (const [state, spec] of Object.entries(STATES)) {
    for (let column = 0; column < spec.frames; column += 1) {
      const input = join(frameRoot, state, `${column}.png`);
      try {
        await access(input);
      } catch {
        if (options.allowMissingStates) continue;
        throw new Error(`missing frame: ${input}`);
      }
      await assertFrame(input);
      composites.push({
        input,
        left: column * PET_SPEC.cellWidth,
        top: spec.row * PET_SPEC.cellHeight,
      });
    }
  }

  for (let direction = 0; direction < 16; direction += 1) {
    const input = join(frameRoot, "look", `${direction}.png`);
    try {
      await access(input);
    } catch {
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
  await sharp({
    create: {
      width: PET_SPEC.sheetWidth,
      height: PET_SPEC.sheetHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .webp({ lossless: true, effort: 6 })
    .toFile(outputPath);
}

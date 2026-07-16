import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PET_SPEC, STATES } from "./pet-spec.js";

type SheetGeometry = {
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
};

export function lookCellFor(
  direction: number,
  geometry: SheetGeometry = PET_SPEC,
): { left: number; top: number } {
  return {
    left: (direction % geometry.columns) * geometry.cellWidth,
    top:
      (geometry.rows - 2 + Math.floor(direction / geometry.columns)) *
      geometry.cellHeight,
  };
}

export async function createContactSheet(
  frameRoot: string,
  outputPath: string,
): Promise<void> {
  const overlays: sharp.OverlayOptions[] = [];

  for (const [state, spec] of Object.entries(STATES)) {
    for (let column = 0; column < spec.frames; column += 1) {
      overlays.push({
        input: join(frameRoot, state, `${column}.png`),
        left: column * PET_SPEC.cellWidth,
        top: spec.row * PET_SPEC.cellHeight,
      });
    }
  }

  for (let direction = 0; direction < 16; direction += 1) {
    overlays.push({
      input: join(frameRoot, "look", `${direction}.png`),
      ...lookCellFor(direction),
    });
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await sharp({
    create: {
      width: PET_SPEC.sheetWidth,
      height: PET_SPEC.sheetHeight,
      channels: 4,
      background: { r: 28, g: 31, b: 38, alpha: 1 },
    },
  })
    .composite(overlays)
    .png()
    .toFile(outputPath);
}

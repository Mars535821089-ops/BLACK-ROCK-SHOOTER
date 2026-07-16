import sharp from "sharp";
import { PET_SPEC } from "./pet-spec.js";

export type FrameValidation = { ok: boolean; errors: string[] };

export async function validateFrame(path: string): Promise<FrameValidation> {
  const metadata = await sharp(path).metadata();
  const errors: string[] = [];

  if (metadata.format !== "png") {
    errors.push(`expected PNG, got ${metadata.format ?? "unknown"}`);
  }
  if (
    metadata.width !== PET_SPEC.cellWidth ||
    metadata.height !== PET_SPEC.cellHeight
  ) {
    errors.push(
      `expected ${PET_SPEC.cellWidth}x${PET_SPEC.cellHeight}, got ${metadata.width ?? 0}x${metadata.height ?? 0}`,
    );
  }
  if (!metadata.hasAlpha) {
    errors.push("frame must have an alpha channel");
  }

  return { ok: errors.length === 0, errors };
}

export async function assertFrame(path: string): Promise<void> {
  const result = await validateFrame(path);
  if (!result.ok) {
    throw new Error(`${path}: ${result.errors.join("; ")}`);
  }
}

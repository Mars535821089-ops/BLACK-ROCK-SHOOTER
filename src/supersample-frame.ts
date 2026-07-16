import sharp from "sharp";

export const SUPERSAMPLE_FACTOR = 4;
export const FINAL_CELL = { width: 192, height: 208 } as const;
export const INTERMEDIATE_CELL = {
  width: FINAL_CELL.width * SUPERSAMPLE_FACTOR,
  height: FINAL_CELL.height * SUPERSAMPLE_FACTOR,
} as const;

export type AlphaBounds = {
  width: number;
  height: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  occupiedPixels: number;
};

const OCCUPIED_ALPHA = 8;

export async function alphaBounds(input: Buffer | string): Promise<AlphaBounds> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  let occupiedPixels = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if ((data[(y * info.width + x) * 4 + 3] ?? 0) <= OCCUPIED_ALPHA) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      occupiedPixels += 1;
    }
  }

  if (maxX < 0 || maxY < 0) {
    return {
      width: 0,
      height: 0,
      left: info.width,
      top: info.height,
      right: info.width,
      bottom: info.height,
      occupiedPixels: 0,
    };
  }

  return {
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    left: minX,
    top: minY,
    right: info.width - 1 - maxX,
    bottom: info.height - 1 - maxY,
    occupiedPixels,
  };
}

export async function finalizeSupersampledFrame(input: Buffer): Promise<Buffer> {
  const metadata = await sharp(input).metadata();
  if (
    metadata.width !== INTERMEDIATE_CELL.width ||
    metadata.height !== INTERMEDIATE_CELL.height
  ) {
    throw new Error(
      `supersampled input must be exactly ${INTERMEDIATE_CELL.width}x${INTERMEDIATE_CELL.height}`,
    );
  }

  const resized = await sharp(input)
    .resize(FINAL_CELL.width, FINAL_CELL.height, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .sharpen({ sigma: 0.45, m1: 0.32, m2: 0.12 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Lanczos can leave numerically tiny RGB/alpha ringing outside the matte.
  // Clear only sub-visible samples; preserve the antialiased edge itself.
  for (let offset = 0; offset < resized.data.length; offset += 4) {
    if ((resized.data[offset + 3] ?? 0) > OCCUPIED_ALPHA) continue;
    resized.data[offset] = 0;
    resized.data[offset + 1] = 0;
    resized.data[offset + 2] = 0;
    resized.data[offset + 3] = 0;
  }

  const safetyBorder = 4;
  for (let y = 0; y < resized.info.height; y += 1) {
    for (let x = 0; x < resized.info.width; x += 1) {
      if (
        x >= safetyBorder &&
        x < resized.info.width - safetyBorder &&
        y >= safetyBorder &&
        y < resized.info.height - safetyBorder
      ) {
        continue;
      }
      const offset = (y * resized.info.width + x) * 4;
      resized.data[offset] = 0;
      resized.data[offset + 1] = 0;
      resized.data[offset + 2] = 0;
      resized.data[offset + 3] = 0;
    }
  }

  return sharp(resized.data, { raw: resized.info }).png().toBuffer();
}

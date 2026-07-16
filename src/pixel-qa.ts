import sharp from "sharp";

export const PIXEL_QA_THRESHOLDS = {
  occupiedAlphaMinimum: 9,
  greenRedDelta: 25,
  greenBlueDelta: 20,
  lowAlphaMaximum: 229,
  whiteChannelMinimum: 241,
} as const;

export type PixelQaResult = {
  width: number;
  height: number;
  occupiedPixels: number;
  greenDominantPixels: number;
  lowAlphaBrightPixels: number;
  transparentRgbPixels: number;
  greenAlphaBins: {
    alpha9To32: number;
    alpha33To64: number;
    alpha65To128: number;
    alpha129To255: number;
  };
};

export async function analyzePixelQa(
  input: Buffer | string,
): Promise<PixelQaResult> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const greenAlphaBins = {
    alpha9To32: 0,
    alpha33To64: 0,
    alpha65To128: 0,
    alpha129To255: 0,
  };
  let occupiedPixels = 0;
  let greenDominantPixels = 0;
  let lowAlphaBrightPixels = 0;
  let transparentRgbPixels = 0;

  for (let offset = 0; offset < data.length; offset += 4) {
    const r = data[offset] ?? 0;
    const g = data[offset + 1] ?? 0;
    const b = data[offset + 2] ?? 0;
    const alpha = data[offset + 3] ?? 0;
    if (alpha === 0 && (r !== 0 || g !== 0 || b !== 0)) transparentRgbPixels += 1;
    if (alpha < PIXEL_QA_THRESHOLDS.occupiedAlphaMinimum) continue;
    occupiedPixels += 1;
    if (
      g > r + PIXEL_QA_THRESHOLDS.greenRedDelta &&
      g > b + PIXEL_QA_THRESHOLDS.greenBlueDelta
    ) {
      greenDominantPixels += 1;
      if (alpha <= 32) greenAlphaBins.alpha9To32 += 1;
      else if (alpha <= 64) greenAlphaBins.alpha33To64 += 1;
      else if (alpha <= 128) greenAlphaBins.alpha65To128 += 1;
      else greenAlphaBins.alpha129To255 += 1;
    }
    if (
      alpha <= PIXEL_QA_THRESHOLDS.lowAlphaMaximum &&
      r >= PIXEL_QA_THRESHOLDS.whiteChannelMinimum &&
      g >= PIXEL_QA_THRESHOLDS.whiteChannelMinimum &&
      b >= PIXEL_QA_THRESHOLDS.whiteChannelMinimum
    ) {
      lowAlphaBrightPixels += 1;
    }
  }

  return {
    width: info.width,
    height: info.height,
    occupiedPixels,
    greenDominantPixels,
    lowAlphaBrightPixels,
    transparentRgbPixels,
    greenAlphaBins,
  };
}

import sharp from "sharp";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { STATE_NAMES, STATES } from "../src/pet-spec.ts";

const [beforeRoot = "work/task-10/before/spritesheet.webp", afterRoot = "assets/frames", output = "work/task-10/quality-metrics.json"] = process.argv.slice(2);
const sizes = [192, 224, 80];

async function framePaths(root) {
  if (root.endsWith(".webp")) {
    const inputs = [];
    for (const state of STATE_NAMES) {
      const spec = STATES[state];
      for (let column = 0; column < spec.frames; column += 1) {
        inputs.push(await sharp(root).extract({ left: column * 192, top: spec.row * 208, width: 192, height: 208 }).png().toBuffer());
      }
    }
    for (let direction = 0; direction < 16; direction += 1) {
      inputs.push(await sharp(root).extract({
        left: (direction % 8) * 192,
        top: (9 + Math.floor(direction / 8)) * 208,
        width: 192,
        height: 208,
      }).png().toBuffer());
    }
    return inputs;
  }
  const paths = [];
  for (const state of await readdir(root)) {
    const stateRoot = join(root, state);
    let files;
    try {
      files = await readdir(stateRoot);
    } catch {
      continue;
    }
    for (const file of files.filter((name) => name.endsWith(".png")).sort((a, b) => Number.parseInt(a) - Number.parseInt(b))) {
      paths.push(join(stateRoot, file));
    }
  }
  return paths.sort();
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function analyze(path, targetWidth) {
  const targetHeight = Math.round((targetWidth * 208) / 192);
  const { data, info } = await sharp(path)
    // Cubic is the closest Sharp analogue to the browser's default smooth CSS scaling.
    .resize(targetWidth, targetHeight, { fit: "fill", kernel: sharp.kernel.cubic })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const luminance = new Float64Array(info.width * info.height);
  const alpha = new Uint8Array(info.width * info.height);
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  let occupiedPixels = 0;
  let antialiasedPixels = 0;
  let greenDominantPixels = 0;
  const greenAlphaBins = { alpha9To32: 0, alpha33To64: 0, alpha65To128: 0, alpha129To255: 0 };
  let transparentRgbPixels = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const pixel = y * info.width + x;
      const offset = pixel * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const a = data[offset + 3];
      alpha[pixel] = a;
      const opacity = a / 255;
      luminance[pixel] =
        (0.2126 * r + 0.7152 * g + 0.0722 * b) * opacity +
        18 * (1 - opacity);
      if (a === 0 && (r !== 0 || g !== 0 || b !== 0)) transparentRgbPixels += 1;
      if (a <= 8) continue;
      occupiedPixels += 1;
      if (a < 247) antialiasedPixels += 1;
      if (g > r + 25 && g > b + 20) {
        greenDominantPixels += 1;
        if (a <= 32) greenAlphaBins.alpha9To32 += 1;
        else if (a <= 64) greenAlphaBins.alpha33To64 += 1;
        else if (a <= 128) greenAlphaBins.alpha65To128 += 1;
        else greenAlphaBins.alpha129To255 += 1;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  let edgeTotal = 0;
  let edgeSamples = 0;
  let detailTotal = 0;
  let detailSamples = 0;
  for (let y = 1; y < info.height - 1; y += 1) {
    for (let x = 1; x < info.width - 1; x += 1) {
      const p = y * info.width + x;
      const left = luminance[p - 1];
      const right = luminance[p + 1];
      const up = luminance[p - info.width];
      const down = luminance[p + info.width];
      const gradient = Math.hypot(right - left, down - up);
      if (
        alpha[p] > 8 || alpha[p - 1] > 8 || alpha[p + 1] > 8 ||
        alpha[p - info.width] > 8 || alpha[p + info.width] > 8
      ) {
        edgeTotal += gradient;
        edgeSamples += 1;
      }
      if (
        alpha[p] > 128 && alpha[p - 1] > 128 && alpha[p + 1] > 128 &&
        alpha[p - info.width] > 128 && alpha[p + info.width] > 128
      ) {
        detailTotal += Math.abs(4 * luminance[p] - left - right - up - down);
        detailSamples += 1;
      }
    }
  }

  return {
    bboxWidth: maxX - minX + 1,
    bboxHeight: maxY - minY + 1,
    bboxArea: (maxX - minX + 1) * (maxY - minY + 1),
    occupiedPixels,
    antialiasedPixels,
    minimumMargin: Math.min(minX, minY, info.width - 1 - maxX, info.height - 1 - maxY),
    edgeStrength: edgeTotal / edgeSamples,
    interiorDetail: detailTotal / detailSamples,
    greenDominantPixels,
    greenAlphaBins,
    transparentRgbPixels,
  };
}

async function analyzeSet(root) {
  const paths = await framePaths(root);
  if (paths.length !== 73) throw new Error(`${root} must contain exactly 73 PNG frames; received ${paths.length}`);
  const result = {};
  for (const size of sizes) {
    const measurements = [];
    for (const path of paths) measurements.push(await analyze(path, size));
    result[size] = {
      averageBBoxWidth: mean(measurements.map((entry) => entry.bboxWidth)),
      averageBBoxHeight: mean(measurements.map((entry) => entry.bboxHeight)),
      averageBBoxArea: mean(measurements.map((entry) => entry.bboxArea)),
      averageOccupiedPixels: mean(measurements.map((entry) => entry.occupiedPixels)),
      averageAntialiasedPixels: mean(measurements.map((entry) => entry.antialiasedPixels)),
      minimumMargin: Math.min(...measurements.map((entry) => entry.minimumMargin)),
      edgeStrength: mean(measurements.map((entry) => entry.edgeStrength)),
      interiorDetail: mean(measurements.map((entry) => entry.interiorDetail)),
      greenDominantPixels: measurements.reduce((sum, entry) => sum + entry.greenDominantPixels, 0),
      greenAlphaBins: Object.fromEntries(
        Object.keys(measurements[0].greenAlphaBins).map((key) => [
          key,
          measurements.reduce((sum, entry) => sum + entry.greenAlphaBins[key], 0),
        ]),
      ),
      transparentRgbPixels: measurements.reduce((sum, entry) => sum + entry.transparentRgbPixels, 0),
    };
  }
  return result;
}

const before = await analyzeSet(beforeRoot);
const after = await analyzeSet(afterRoot);
const percent = (newValue, oldValue) => ((newValue - oldValue) / oldValue) * 100;
const comparison = Object.fromEntries(sizes.map((size) => [size, {
  bboxAreaPercent: percent(after[size].averageBBoxArea, before[size].averageBBoxArea),
  occupiedPixelsPercent: percent(after[size].averageOccupiedPixels, before[size].averageOccupiedPixels),
  edgeStrengthPercent: percent(after[size].edgeStrength, before[size].edgeStrength),
  interiorDetailPercent: percent(after[size].interiorDetail, before[size].interiorDetail),
}]))
const report = {
  source: { beforeRoot, afterRoot },
  frameCount: 73,
  sizes,
  greenCandidateMethod: {
    region: "entire transparent frame after cubic evidence resampling; alpha >= 9",
    threshold: "g > r + 25 and g > b + 20",
    interpretation: "candidate count only; inspect alpha bins and real Playwright screenshot QA before labeling fringe",
  },
  before,
  after,
  comparison,
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

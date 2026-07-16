import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { STATE_NAMES, STATES } from "../src/pet-spec.ts";

const [frameRoot = "assets/frames", outputRoot = "work/task-10/after", prefix = "all-frames"] = process.argv.slice(2);
const columns = 8;
const background = { r: 28, g: 31, b: 38, alpha: 1 };
const paths = [];
for (const state of STATE_NAMES) {
  for (let frame = 0; frame < STATES[state].frames; frame += 1) {
    paths.push(join(frameRoot, state, `${frame}.png`));
  }
}
for (let direction = 0; direction < 16; direction += 1) {
  paths.push(join(frameRoot, "look", `${direction}.png`));
}
if (paths.length !== 73) throw new Error(`quality evidence requires 73 frames; received ${paths.length}`);

await mkdir(outputRoot, { recursive: true });
for (const width of [192, 224, 80]) {
  const height = Math.round((width * 208) / 192);
  const rows = Math.ceil(paths.length / columns);
  const overlays = [];
  for (let index = 0; index < paths.length; index += 1) {
    const input = width === 192
      ? paths[index]
      : await sharp(paths[index]).resize(width, height, { fit: "fill", kernel: sharp.kernel.cubic }).png().toBuffer();
    overlays.push({
      input,
      left: (index % columns) * width,
      top: Math.floor(index / columns) * height,
    });
  }
  await sharp({
    create: {
      width: columns * width,
      height: rows * height,
      channels: 4,
      background,
    },
  })
    .composite(overlays)
    .png()
    .toFile(join(outputRoot, `${prefix}-${width}.png`));
}

console.log(`quality evidence: ${paths.length} frames at native, 224px, and 80px`);

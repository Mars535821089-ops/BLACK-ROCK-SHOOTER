import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { STATE_NAMES, STATES } from "../src/pet-spec.ts";

const [frameRoot = "assets/frames", outputRoot = "work/task-10/after", prefix = "all-frames"] = process.argv.slice(2);
const columns = 8;
const background = { r: 28, g: 31, b: 38, alpha: 1 };
const archivedSheet = frameRoot.endsWith(".webp");
const inputs = [];
if (archivedSheet) {
  for (const state of STATE_NAMES) {
    const spec = STATES[state];
    for (let column = 0; column < spec.frames; column += 1) {
      inputs.push(await sharp(frameRoot).extract({
        left: column * 192,
        top: spec.row * 208,
        width: 192,
        height: 208,
      }).png().toBuffer());
    }
  }
  for (let direction = 0; direction < 16; direction += 1) {
    inputs.push(await sharp(frameRoot).extract({
      left: (direction % 8) * 192,
      top: (9 + Math.floor(direction / 8)) * 208,
      width: 192,
      height: 208,
    }).png().toBuffer());
  }
} else {
  for (const state of STATE_NAMES) {
    for (let frame = 0; frame < STATES[state].frames; frame += 1) {
      inputs.push(join(frameRoot, state, `${frame}.png`));
    }
  }
  for (let direction = 0; direction < 16; direction += 1) {
    inputs.push(join(frameRoot, "look", `${direction}.png`));
  }
}
if (inputs.length !== 73) throw new Error(`quality evidence requires 73 frames; received ${inputs.length}`);

await mkdir(outputRoot, { recursive: true });
if (archivedSheet) {
  await sharp(frameRoot)
    .flatten({ background })
    .png()
    .toFile(join(outputRoot, "contact-sheet-native.png"));
}
for (const width of [192, 224, 80]) {
  const height = Math.round((width * 208) / 192);
  const rows = Math.ceil(inputs.length / columns);
  const overlays = [];
  for (let index = 0; index < inputs.length; index += 1) {
    const input = width === 192
      ? inputs[index]
      : await sharp(inputs[index]).resize(width, height, { fit: "fill", kernel: sharp.kernel.cubic }).png().toBuffer();
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

console.log(`quality evidence: ${inputs.length} frames at native, 224px, and 80px${archivedSheet ? "; archived contact sheet restored" : ""}`);

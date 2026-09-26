import { mkdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "dist/blueflame/spritesheet.webp");
const output = join(root, "dist/web/BLACK-ROCK-SHOOTER.webp");
const sourceWidth = 1536;
const sourceHeight = 2288;
const webHeight = 1872;
const maxBytes = 20 * 1024 * 1024;

const metadata = await sharp(source).metadata();
if (
  metadata.format !== "webp" ||
  metadata.width !== sourceWidth ||
  metadata.height !== sourceHeight ||
  !metadata.hasAlpha
) {
  throw new Error("Desktop sprite sheet must be a transparent 1536×2288 WebP");
}

await mkdir(dirname(output), { recursive: true });
await sharp(source)
  .extract({ left: 0, top: 0, width: sourceWidth, height: webHeight })
  .webp({ lossless: true, effort: 6 })
  .toFile(output);

const result = await sharp(output).metadata();
const { size } = await stat(output);
if (
  result.format !== "webp" ||
  result.width !== sourceWidth ||
  result.height !== webHeight ||
  !result.hasAlpha ||
  size > maxBytes
) {
  throw new Error("Web sprite sheet does not meet the upload requirements");
}

console.log(`Web sprite sheet ready: ${output} (${size} bytes)`);

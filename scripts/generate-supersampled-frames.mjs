import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  INTERMEDIATE_CELL,
  SUPERSAMPLE_FACTOR,
  finalizeSupersampledFrame,
} from "../src/supersample-frame.ts";

const ROOT = process.cwd();
const KEYS = join(ROOT, "assets/key-poses");
const OUT = join(ROOT, "assets/frames");
const FRAME = INTERMEDIATE_CELL;
const U = SUPERSAMPLE_FACTOR;
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

const sources = {
  idle: join(ROOT, "assets/master/blueflame-master.png"),
  right: join(KEYS, "running-right.png"),
  rightB: join(KEYS, "running-right-b.png"),
  leftA: join(KEYS, "running-left-a.png"),
  leftB: join(KEYS, "running-left-b.png"),
  wait: join(KEYS, "waiting.png"),
  jump: join(KEYS, "jumping.png"),
  failed: join(KEYS, "failed.png"),
  ready: join(KEYS, "ready.png"),
  wave: join(KEYS, "waving.png"),
  lookUp: join(KEYS, "look-up.png"),
  lookNE: join(KEYS, "look-ne.png"),
  lookRight: join(KEYS, "look-right.png"),
  lookSE: join(KEYS, "look-se.png"),
  lookDown: join(KEYS, "look-down.png"),
  lookSW: join(KEYS, "look-sw.png"),
  lookLeft: join(KEYS, "look-left.png"),
  lookNW: join(KEYS, "look-nw.png"),
};

async function isolatedIdle() {
  // The approved master places the sword in a separate viewer-right region.
  // Cropping that region produces the immutable no-weapon character source.
  const cropped = await sharp(sources.idle)
    .extract({ left: 0, top: 0, width: 700, height: 1700 })
    .png()
    .toBuffer();
  return sharp(cropped).trim({ background: transparent }).png().toBuffer();
}

const idleSource = await isolatedIdle();

async function extractMasterFlame() {
  const { data, info } = await sharp(sources.idle)
    .extract({ left: 360, top: 130, width: 190, height: 190 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const seed = new Uint8Array(info.width * info.height);
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const p = (y * info.width + x) * 4;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const diagonal = 130 - 0.75 * x;
    if (x >= 42 && y >= diagonal - 30 && y <= diagonal + 28 && b > 105 && g > 55 && b > r + 45 && g > r + 18) {
      seed[y * info.width + x] = 1;
    }
  }
  const out = Buffer.alloc(data.length);
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    let distance = 99;
    for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) {
      const xx = x + ox, yy = y + oy;
      if (xx >= 0 && xx < info.width && yy >= 0 && yy < info.height && seed[yy * info.width + xx]) distance = Math.min(distance, Math.hypot(ox, oy));
    }
    if (distance <= 2.25) {
      const p = (y * info.width + x) * 4;
      out[p] = data[p]; out[p + 1] = data[p + 1]; out[p + 2] = data[p + 2];
      out[p + 3] = Math.min(data[p + 3], distance < 0.5 ? 255 : distance < 1.5 ? 205 : 110);
    }
  }
  const isolated = await sharp(out, { raw: info }).png().toBuffer();
  return sharp(isolated).trim({ background: transparent }).resize({ width: 24 * U, height: 21 * U, fit: "inside", kernel: sharp.kernel.lanczos3 }).png().toBuffer();
}

const masterFlame = await extractMasterFlame();

async function despillSource(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let offset = 0; offset < data.length; offset += 4) {
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const alpha = data[offset + 3];
    if (alpha <= 8) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    } else if (g > r + 24 && g > b + 14) {
      data[offset + 1] = Math.max(r, b);
    }
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

async function pose(input, { maxWidth, maxHeight, rotate = 0, opacity = 1 } = {}) {
  let pipeline = sharp(await despillSource(input)).trim({ background: transparent });
  if (rotate) {
    pipeline = pipeline.rotate(rotate, { background: transparent }).trim({ background: transparent });
  }
  pipeline = pipeline.resize({
    width: maxWidth * U,
    height: maxHeight * U,
    fit: "inside",
    withoutEnlargement: false,
    kernel: sharp.kernel.lanczos3,
  });
  if (opacity !== 1) {
    pipeline = pipeline.ensureAlpha().linear([1, 1, 1, opacity], [0, 0, 0, 0]);
  }
  return pipeline.png().toBuffer();
}

async function svgOverlay(svg) {
  return Buffer.from(`<svg width="768" height="832" viewBox="0 0 192 208" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`);
}

async function render(state, index, input, options = {}) {
  const {
    maxWidth = 126,
    maxHeight = 200,
    centerX = 96,
    baseline = 204,
    dx = 0,
    dy = 0,
    rotate = 0,
    overlays = [],
    mutate,
  } = options;
  const subject = await pose(input, { maxWidth, maxHeight, rotate });
  const meta = await sharp(subject).metadata();
  const safety = 4 * U;
  const intendedLeft = Math.round((centerX + dx) * U - meta.width / 2);
  const intendedTop = Math.round((baseline + dy) * U - meta.height);
  const left = Math.max(safety, Math.min(intendedLeft, FRAME.width - safety - meta.width));
  const top = Math.max(safety, Math.min(intendedTop, FRAME.height - safety - meta.height));
  const canvas = sharp({ create: { ...FRAME, channels: 4, background: transparent } });
  let intermediate = await canvas
    .composite([{ input: subject, left, top }, ...overlays.map((o) => ({ input: o, left: 0, top: 0 }))])
    .png()
    .toBuffer();
  if (mutate) intermediate = await mutate(intermediate);
  const final = await finalizeSupersampledFrame(intermediate);
  await sharp(await despillSource(final)).toFile(join(OUT, state, `${index}.png`));
}

async function anchorLeftRunFlame(input, strideB, dx, dy) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (strideB) {
    // Remove the generator's misplaced viewer-left cyan mark without touching
    // the jacket/star; the corrected flame is composited on viewer-right.
    for (let y = (88 + dy) * U; y <= (112 + dy) * U; y++) for (let x = (35 + dx) * U; x <= (61 + dx) * U; x++) {
      const p = (y * info.width + x) * 4;
      const r = data[p], g = data[p + 1], b = data[p + 2];
      if (data[p + 3] > 20 && b > r + 35 && g > r + 20) {
        data[p] = 15; data[p + 1] = 24; data[p + 2] = 36;
      }
    }
  }
  const fx = ((strideB ? 66 : 92) + dx) * U;
  const fy = ((strideB ? 89 : 71) + dy) * U;
  const base = await sharp(data, { raw: info }).png().toBuffer();
  return sharp(base).composite([{ input: masterFlame, left: fx, top: fy }]).png().toBuffer();
}

for (const state of ["idle", "running-right", "running-left", "waving", "jumping", "failed", "waiting", "running", "review", "look"]) {
  await mkdir(join(OUT, state), { recursive: true });
}

// Idle: breathing/sway loop with a distinct blink at frame 2.
for (let i = 0; i < 6; i++) {
  const blink = i === 2
    ? [await svgOverlay(`<path d="M82 44 Q87 47 92 44 M101 44 Q106 47 111 44" fill="none" stroke="#111722" stroke-width="2.2" stroke-linecap="round"/>`)]
    : [];
  await render("idle", i, idleSource, {
    maxWidth: 126,
    maxHeight: 200,
    dx: [0, 1, 1, 0, -1, -1][i],
    dy: [0, -1, -2, -1, 0, 1][i],
    rotate: [0, 0.25, 0.45, -0.12, -0.35, -0.15][i],
    overlays: blink,
  });
}

// Directional dashes use separately authored key poses, never mirroring.
for (let i = 0; i < 8; i++) {
  const phase = (i / 8) * Math.PI * 2;
  const strideB = i === 2 || i === 3 || i === 6 || i === 7;
  await render("running-right", i, strideB ? sources.rightB : sources.right, {
    maxWidth: strideB ? 180 : 136,
    maxHeight: 200,
    centerX: 96,
    dx: Math.round(Math.sin(phase) * 2),
    dy: Math.round(-Math.abs(Math.sin(phase)) * 4),
    rotate: Math.cos(phase) * 0.8,
  });
  const leftDx = Math.round(-Math.sin(phase) * 2);
  const leftDy = Math.round(-Math.abs(Math.sin(phase)) * 4);
  await render("running-left", i, strideB ? sources.leftB : sources.leftA, {
    maxWidth: strideB ? 151 : 180,
    maxHeight: 200,
    centerX: 96,
    dx: leftDx,
    dy: leftDy,
    rotate: -Math.cos(phase) * 0.8,
    mutate: (input) => anchorLeftRunFlame(input, strideB, leftDx, leftDy),
  });
}

// Flourish: sword appears, completes a compact arc, then vanishes after sheathing.
await render("waving", 0, sources.wave, { maxWidth: 163, maxHeight: 190, rotate: -12, dx: -2 });
await render("waving", 1, sources.wave, { maxWidth: 176, maxHeight: 200, rotate: -2 });
await render("waving", 2, sources.wave, { maxWidth: 171, maxHeight: 194, rotate: 8, dx: 2 });
const smile = await svgOverlay(`<path d="M94 49 Q98 52 102 49" fill="none" stroke="#8d4c55" stroke-width="1.3"/><circle cx="89" cy="52" r="3" fill="#ff8fa3" opacity=".24"/><circle cx="107" cy="52" r="3" fill="#ff8fa3" opacity=".24"/>`);
await render("waving", 3, idleSource, { maxWidth: 128, maxHeight: 200, dx: 1, overlays: [smile] });

// Small surprised hop and embarrassed recovery.
await render("jumping", 0, sources.jump, { maxWidth: 146, maxHeight: 193, baseline: 202, rotate: -2 });
await render("jumping", 1, sources.jump, { maxWidth: 146, maxHeight: 193, baseline: 194, rotate: -1 });
await render("jumping", 2, sources.jump, { maxWidth: 146, maxHeight: 193, baseline: 188 });
await render("jumping", 3, sources.jump, { maxWidth: 146, maxHeight: 193, baseline: 195, rotate: 1 });
const blush = await svgOverlay(`<circle cx="87" cy="51" r="4" fill="#ff7893" opacity=".3"/><circle cx="108" cy="51" r="4" fill="#ff7893" opacity=".3"/>`);
await render("jumping", 4, idleSource, { maxWidth: 128, maxHeight: 200, dx: -1, rotate: -1.2, overlays: [blush] });

// Failure: guard breaks, body lowers, blade plants vertically; flame dims via cyan veil.
for (let i = 0; i < 8; i++) {
  if (i < 2) {
    await render("failed", i, sources.ready, { maxWidth: 159, maxHeight: 200, dy: i * 2, rotate: i * 1.2 });
  } else if (i === 2) {
    await render("failed", i, sources.wave, { maxWidth: 165, maxHeight: 188, rotate: 6, dy: 3 });
  } else {
    const dim = await svgOverlay(`<circle cx="106" cy="39" r="8" fill="#14253d" opacity="${0.15 + (i - 3) * 0.06}"/>`);
    await render("failed", i, sources.failed, {
      maxWidth: 155,
      maxHeight: [198, 197, 196, 195, 194][i - 3],
      dy: [0, 1, 2, 3, 3][i - 3],
      rotate: [2.5, 1.5, 0.8, 0.3, 0][i - 3],
      overlays: [dim],
    });
  }
}

// Folded-arm impatience: lean, head tilt and blink, no sword.
for (let i = 0; i < 6; i++) {
  const blink = i === 3
    ? [await svgOverlay(`<path d="M83 45 Q88 48 93 45 M101 45 Q106 48 111 45" fill="none" stroke="#111722" stroke-width="2.2" stroke-linecap="round"/>`)]
    : [];
  await render("waiting", i, sources.wait, {
    maxWidth: 136,
    maxHeight: 198,
    dx: [0, 0, 1, 1, 0, -1][i],
    dy: [0, 0, -1, -1, 0, 1][i],
    rotate: [-0.8, -0.3, 0.4, 1.1, 0.4, -0.4][i],
    overlays: blink,
  });
}

// Draw-to-ready arc: neutral, transitional flourish, then bright ready guard.
await render("running", 0, sources.wave, { maxWidth: 165, maxHeight: 200, rotate: -8 });
await render("running", 1, sources.wave, { maxWidth: 169, maxHeight: 200, rotate: -4 });
for (let i = 2; i < 6; i++) {
  const glow = await svgOverlay(`<circle cx="108" cy="38" r="${8 + i}" fill="#36bfff" opacity="${0.07 + i * 0.02}"/>`);
  await render("running", i, sources.ready, {
    maxWidth: 159,
    maxHeight: 200,
    rotate: [2, 0, -1, 0][i - 2],
    dx: [1, 0, -1, 0][i - 2],
    overlays: [glow],
  });
}

// Review: translucent code pane appears, is scanned, then a small nod.
for (let i = 0; i < 6; i++) {
  const pane = [await svgOverlay(`
    <rect x="112" y="48" width="72" height="84" rx="6" fill="#39bfff" fill-opacity="${0.12 + i * 0.025}" stroke="#64d7ff" stroke-opacity="0.82"/>
    <path d="M122 67h43M122 80h31M122 93h39M122 106h27M122 119h35" stroke="#8de9ff" stroke-width="2.4" stroke-linecap="round" opacity="0.82"/>
    <circle cx="173" cy="59" r="2.5" fill="#8de9ff" opacity="0.9"/>`)] ;
  await render("review", i, idleSource, {
    maxWidth: 128,
    maxHeight: 200,
    centerX: 74,
    dx: [0, 1, 1, 0, -1, -1][i],
    dy: [0, 0, -1, -2, 1, 2][i],
    rotate: [0.8, 0.5, 0.2, -0.3, -1.4, 1.2][i],
    overlays: pane,
  });
}

// Eight generated 45-degree head silhouettes plus explicit 22.5-degree gaze
// offsets make all 16 compass positions readable at thumbnail size.
const compass = [sources.lookUp, sources.lookNE, sources.lookRight, sources.lookSE, sources.lookDown, sources.lookSW, sources.lookLeft, sources.lookNW];
for (let i = 0; i < 16; i++) {
  const a = -Math.PI / 2 + i * (Math.PI / 8);
  const gx = Math.cos(a) * 4.2;
  const gy = Math.sin(a) * 3.4;
  const gaze = await svgOverlay(`<circle cx="96" cy="42" r="2.3" fill="#d7f6ff"/><circle cx="${96 + gx}" cy="${42 + gy}" r="1.8" fill="#248dce"/>`);
  await render("look", i, compass[Math.floor(i / 2)], {
    maxWidth: 130,
    maxHeight: 200,
    dx: i % 2 ? Math.round(Math.cos(a) * 2) : 0,
    rotate: i % 2 ? Math.sin(a) * 1.8 : 0,
    overlays: [gaze],
  });
}

console.log("73 frames rendered");

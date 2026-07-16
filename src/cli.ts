import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import sharp from "sharp";
import { assembleSpritesheet } from "./assemble-spritesheet.js";
import { createContactSheet } from "./contact-sheet.js";
import { installPet } from "./install-pet.js";
import { createManifest, writeManifest } from "./manifest.js";
import { PET_SPEC, STATES } from "./pet-spec.js";
import { assertFrame } from "./validate-frame.js";

const commands = ["validate", "build", "install", "contact-sheet"] as const;
export type Command = (typeof commands)[number];

export function parseCommand(args: string[]): Command {
  const command = args[0];
  if (!commands.includes(command as Command)) {
    throw new Error(`unknown command: ${command ?? "missing"}`);
  }
  return command as Command;
}

export async function validateAll(
  frameRoot = "assets/frames",
  validate: typeof assertFrame = assertFrame,
): Promise<number> {
  let count = 0;
  for (const [state, spec] of Object.entries(STATES)) {
    for (let column = 0; column < spec.frames; column += 1) {
      await validate(join(frameRoot, state, `${column}.png`));
      count += 1;
    }
  }
  for (let direction = 0; direction < 16; direction += 1) {
    await validate(join(frameRoot, "look", `${direction}.png`));
    count += 1;
  }
  return count;
}

export async function validateBuild(directory: string): Promise<void> {
  const manifest = JSON.parse(
    await readFile(join(directory, "pet.json"), "utf8"),
  ) as unknown;
  if (!isDeepStrictEqual(manifest, createManifest())) {
    throw new Error("invalid pet.json");
  }

  const metadata = await sharp(join(directory, "spritesheet.webp")).metadata();
  if (
    metadata.format !== "webp" ||
    metadata.width !== PET_SPEC.sheetWidth ||
    metadata.height !== PET_SPEC.sheetHeight ||
    !metadata.hasAlpha
  ) {
    throw new Error("invalid spritesheet.webp");
  }
}

type Dependencies = {
  validateAll: typeof validateAll;
  assembleSpritesheet: typeof assembleSpritesheet;
  writeManifest: typeof writeManifest;
  validateBuild: typeof validateBuild;
  createContactSheet: typeof createContactSheet;
  installPet: typeof installPet;
};

type RunOptions = {
  frameRoot?: string;
  distDir?: string;
  contactSheetPath?: string;
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
  log?: (message: string) => void;
  dependencies?: Partial<Dependencies>;
};

const defaultDependencies: Dependencies = {
  validateAll,
  assembleSpritesheet,
  writeManifest,
  validateBuild,
  createContactSheet,
  installPet,
};

export async function runCommand(
  command: Command,
  options: RunOptions = {},
): Promise<void> {
  const frameRoot = options.frameRoot ?? "assets/frames";
  const distDir = options.distDir ?? "dist/blueflame";
  const contactSheetPath =
    options.contactSheetPath ?? "work/frame-review/contact-sheet.png";
  const dependencies = {
    ...defaultDependencies,
    ...options.dependencies,
  };
  const log = options.log ?? console.log;

  if (command === "validate") {
    log(`${await dependencies.validateAll(frameRoot)} frames valid; 0 errors`);
    return;
  }
  if (command === "contact-sheet") {
    await dependencies.createContactSheet(frameRoot, contactSheetPath);
    return;
  }
  if (command === "build") {
    await dependencies.validateAll(frameRoot);
    await dependencies.assembleSpritesheet(
      frameRoot,
      join(distDir, "spritesheet.webp"),
    );
    await dependencies.writeManifest(join(distDir, "pet.json"));
    await dependencies.validateBuild(distDir);
    return;
  }

  await dependencies.validateBuild(distDir);
  const env = options.env ?? process.env;
  const petsRoot = join(
    env.CODEX_HOME ?? join(options.homeDir ?? homedir(), ".codex"),
    "pets",
  );
  const result = await dependencies.installPet({
    sourceDir: distDir,
    petsRoot,
    slug: "blueflame",
    validate: dependencies.validateBuild,
  });
  log(`Installed to ${result.target}`);
}

async function main(): Promise<void> {
  await runCommand(parseCommand(process.argv.slice(2)));
}

if (process.argv[1]?.endsWith("cli.ts")) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

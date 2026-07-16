import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { assembleSpritesheet } from "./assemble-spritesheet.js";
import { createContactSheet } from "./contact-sheet.js";
import { installPet } from "./install-pet.js";
import { writeManifest } from "./manifest.js";
import { PET_SPEC, STATES } from "./pet-spec.js";
import { assertFrame } from "./validate-frame.js";

const commands = ["validate", "build", "install", "contact-sheet"] as const;
type Command = (typeof commands)[number];

export function parseCommand(args: string[]): Command {
  const command = args[0];
  if (!commands.includes(command as Command)) {
    throw new Error(`unknown command: ${command ?? "missing"}`);
  }
  return command as Command;
}

export async function validateAll(frameRoot = "assets/frames"): Promise<number> {
  let count = 0;
  for (const [state, spec] of Object.entries(STATES)) {
    for (let column = 0; column < spec.frames; column += 1) {
      await assertFrame(join(frameRoot, state, `${column}.png`));
      count += 1;
    }
  }
  for (let direction = 0; direction < 16; direction += 1) {
    await assertFrame(join(frameRoot, "look", `${direction}.png`));
    count += 1;
  }
  return count;
}

async function validateBuild(directory: string): Promise<void> {
  const manifest = JSON.parse(
    await readFile(join(directory, "pet.json"), "utf8"),
  ) as Record<string, unknown>;
  if (
    manifest.spriteVersionNumber !== 2 ||
    manifest.spritesheetPath !== "spritesheet.webp"
  ) {
    throw new Error("invalid pet.json");
  }

  const metadata = await sharp(join(directory, "spritesheet.webp")).metadata();
  if (
    metadata.width !== PET_SPEC.sheetWidth ||
    metadata.height !== PET_SPEC.sheetHeight ||
    !metadata.hasAlpha
  ) {
    throw new Error("invalid spritesheet.webp");
  }
}

async function main(): Promise<void> {
  const command = parseCommand(process.argv.slice(2));
  if (command === "validate") {
    console.log(`${await validateAll()} frames valid; 0 errors`);
    return;
  }
  if (command === "contact-sheet") {
    await createContactSheet(
      "assets/frames",
      "work/frame-review/contact-sheet.png",
    );
    return;
  }
  if (command === "build") {
    await validateAll();
    await assembleSpritesheet(
      "assets/frames",
      "dist/blueflame/spritesheet.webp",
    );
    await writeManifest("dist/blueflame/pet.json");
    await validateBuild("dist/blueflame");
    return;
  }

  await validateBuild("dist/blueflame");
  const petsRoot = join(
    process.env.CODEX_HOME ?? join(homedir(), ".codex"),
    "pets",
  );
  const result = await installPet({
    sourceDir: "dist/blueflame",
    petsRoot,
    slug: "blueflame",
    validate: validateBuild,
  });
  console.log(`Installed to ${result.target}`);
}

if (process.argv[1]?.endsWith("cli.ts")) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

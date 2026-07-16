import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseCommand,
  runCommand,
  validateAll,
  validateBuild,
} from "../src/cli.js";
import { createContactSheet, lookCellFor } from "../src/contact-sheet.js";
import { createManifest } from "../src/manifest.js";
import { PET_SPEC, STATES } from "../src/pet-spec.js";

const temporaryPaths: string[] = [];

it("checks in one reproducible command for contact-sheet and preview evidence", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
    scripts?: Record<string, string>;
  };

  expect(packageJson.scripts?.["capture:evidence"]).toBe(
    "tsx src/cli.ts contact-sheet && playwright test tests/preview.spec.ts --grep \"maps every state row|captures every state at the native review sizes\"",
  );
});

async function temporaryDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "blueflame-cli-"));
  temporaryPaths.push(path);
  return path;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryPaths.splice(0).map((path) =>
      rm(path, { recursive: true, force: true }),
    ),
  );
});

it("accepts only supported commands without interpreting trailing arguments", () => {
  expect(parseCommand(["build"])).toBe("build");
  expect(parseCommand(["validate"])).toBe("validate");
  expect(parseCommand(["install"])).toBe("install");
  expect(parseCommand(["contact-sheet"])).toBe("contact-sheet");
  expect(parseCommand(["build", "delete"])).toBe("build");
  expect(() => parseCommand(["delete"])).toThrow("unknown command: delete");
  expect(() => parseCommand([])).toThrow("unknown command: missing");
});

it("validates exactly the 73 required frame paths", async () => {
  const paths: string[] = [];
  const count = await validateAll("/frames", async (path) => {
    paths.push(path);
  });

  const expected = [
    ...Object.entries({
      idle: 6,
      "running-right": 8,
      "running-left": 8,
      waving: 4,
      jumping: 5,
      failed: 8,
      waiting: 6,
      running: 6,
      review: 6,
    }).flatMap(([state, frames]) =>
      Array.from({ length: frames }, (_, column) =>
        join("/frames", state, `${column}.png`),
      ),
    ),
    ...Array.from({ length: 16 }, (_, direction) =>
      join("/frames", "look", `${direction}.png`),
    ),
  ];

  expect(count).toBe(73);
  expect(paths).toEqual(expected);
});

it("builds only to the requested blueflame destinations and validates afterward", async () => {
  const calls: string[] = [];
  await runCommand("build", {
    frameRoot: "/frames",
    distDir: "/dist/blueflame",
    dependencies: {
      validateAll: async (root) => {
        calls.push(`validate frames ${root}`);
        return 73;
      },
      assembleSpritesheet: async (root, output) => {
        calls.push(`assemble ${root} ${output}`);
      },
      writeManifest: async (path) => {
        calls.push(`manifest ${path}`);
      },
      validateBuild: async (directory) => {
        calls.push(`validate build ${directory}`);
      },
    },
  });

  expect(calls).toEqual([
    "validate frames /frames",
    "assemble /frames /dist/blueflame/spritesheet.webp",
    "manifest /dist/blueflame/pet.json",
    "validate build /dist/blueflame",
  ]);
});

describe("strict build validation", () => {
  async function writeSprite(
    directory: string,
    format: "webp" | "png" = "webp",
  ): Promise<void> {
    const image = sharp({
      create: {
        width: PET_SPEC.sheetWidth,
        height: PET_SPEC.sheetHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    });
    const output = join(directory, "spritesheet.webp");
    if (format === "webp") await image.webp({ lossless: true }).toFile(output);
    else await image.png().toFile(output);
  }

  it("accepts only the exact manifest and a correctly formatted WebP", async () => {
    const directory = await temporaryDirectory();
    await writeFile(
      join(directory, "pet.json"),
      JSON.stringify(createManifest()),
    );
    await writeSprite(directory);

    await expect(validateBuild(directory)).resolves.toBeUndefined();

    for (const manifest of [
      { ...createManifest(), displayName: "Blueflame" },
      { ...createManifest(), description: "wrong" },
      { ...createManifest(), spriteVersionNumber: 1 },
      { ...createManifest(), spritesheetPath: "sprite.webp" },
      {
        displayName: createManifest().displayName,
        spriteVersionNumber: 2,
        spritesheetPath: "spritesheet.webp",
      },
      { ...createManifest(), extra: true },
    ]) {
      await writeFile(join(directory, "pet.json"), JSON.stringify(manifest));
      await expect(validateBuild(directory)).rejects.toThrow("invalid pet.json");
    }

    await writeFile(
      join(directory, "pet.json"),
      JSON.stringify(createManifest()),
    );
    await writeSprite(directory, "png");
    await expect(validateBuild(directory)).rejects.toThrow(
      "invalid spritesheet.webp",
    );
  });

  it.each(["manifest", "format"] as const)(
    "rejects a corrupted %s during post-build validation",
    async (corruption) => {
      const distDir = await temporaryDirectory();
      await expect(
        runCommand("build", {
          frameRoot: "/frames",
          distDir,
          dependencies: {
            validateAll: async () => 73,
            assembleSpritesheet: async (_root, output) => {
              const image = sharp({
                create: {
                  width: PET_SPEC.sheetWidth,
                  height: PET_SPEC.sheetHeight,
                  channels: 4,
                  background: { r: 0, g: 0, b: 0, alpha: 0 },
                },
              });
              if (corruption === "format") await image.png().toFile(output);
              else await image.webp({ lossless: true }).toFile(output);
            },
            writeManifest: async (path) => {
              const manifest =
                corruption === "manifest"
                  ? { ...createManifest(), displayName: "corrupted" }
                  : createManifest();
              await writeFile(path, JSON.stringify(manifest));
            },
          },
        }),
      ).rejects.toThrow(
        corruption === "manifest"
          ? "invalid pet.json"
          : "invalid spritesheet.webp",
      );
    },
  );
});

it("routes install through CODEX_HOME/pets/blueflame without using homeDir", async () => {
  const codexHome = await temporaryDirectory();
  const installPet = vi.fn(async (options) => ({
    target: join(options.petsRoot, options.slug),
    backupPath: null,
  }));
  const log = vi.fn();

  await runCommand("install", {
    distDir: "/dist/blueflame",
    env: { CODEX_HOME: codexHome },
    homeDir: "/must-not-be-used",
    log,
    dependencies: {
      validateBuild: async () => undefined,
      installPet,
    },
  });

  expect(installPet).toHaveBeenCalledOnce();
  const options = installPet.mock.calls[0]?.[0];
  expect(options).toMatchObject({
    sourceDir: "/dist/blueflame",
    petsRoot: join(codexHome, "pets"),
    slug: "blueflame",
  });
  expect(options?.petsRoot).not.toContain("must-not-be-used");
  expect(log).toHaveBeenCalledWith(
    `Installed to ${join(codexHome, "pets", "blueflame")}`,
  );
});

it("falls back to homeDir/.codex/pets/blueflame when CODEX_HOME is absent", async () => {
  const homeDir = await temporaryDirectory();
  const installPet = vi.fn(async (options) => ({
    target: join(options.petsRoot, options.slug),
    backupPath: null,
  }));
  const log = vi.fn();

  await runCommand("install", {
    distDir: "/dist/blueflame",
    env: {},
    homeDir,
    log,
    dependencies: {
      validateBuild: async () => undefined,
      installPet,
    },
  });

  const expectedTarget = join(
    homeDir,
    ".codex",
    "pets",
    "blueflame",
  );
  expect(installPet).toHaveBeenCalledOnce();
  expect(installPet.mock.calls[0]?.[0]).toMatchObject({
    sourceDir: "/dist/blueflame",
    petsRoot: join(homeDir, ".codex", "pets"),
    slug: "blueflame",
  });
  expect(log).toHaveBeenCalledWith(`Installed to ${expectedTarget}`);
});

it("runs only contact-sheet orchestration for the contact-sheet command", async () => {
  const create = vi.fn(async () => undefined);
  const validate = vi.fn(async () => 73);
  const assemble = vi.fn(async () => undefined);
  const install = vi.fn();

  await runCommand("contact-sheet", {
    frameRoot: "/frames",
    contactSheetPath: "/review/contact-sheet.png",
    dependencies: {
      createContactSheet: create,
      validateAll: validate,
      assembleSpritesheet: assemble,
      installPet: install,
    },
  });

  expect(create).toHaveBeenCalledWith(
    "/frames",
    "/review/contact-sheet.png",
  );
  expect(validate).not.toHaveBeenCalled();
  expect(assemble).not.toHaveBeenCalled();
  expect(install).not.toHaveBeenCalled();
});

it("renders every configured state cell and both derived look rows", async () => {
  expect(
    lookCellFor(8, {
      columns: 8,
      rows: 15,
      cellWidth: 10,
      cellHeight: 20,
    }),
  ).toEqual({ left: 0, top: 14 * 20 });

  const root = await temporaryDirectory();
  const output = join(root, "review", "contact-sheet.png");
  const pixel = (r: number, g: number, b: number) =>
    sharp({
      create: {
        width: 1,
        height: 1,
        channels: 4,
        background: { r, g, b, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
  const blue = await pixel(0, 0, 255);
  const red = await pixel(255, 0, 0);
  const green = await pixel(0, 255, 0);
  const stateSamples = await Promise.all(
    Object.entries(STATES).map(async ([state, spec], index) => {
      const color = [
        20 + index * 20,
        30 + index * 15,
        40 + index * 10,
      ] as const;
      return {
        state,
        spec,
        column: Math.min(index + 1, spec.frames - 1),
        color,
        buffer: await pixel(...color),
      };
    }),
  );

  for (const sample of stateSamples) {
    const { state, spec, column: representativeColumn, buffer } = sample;
    await mkdir(join(root, state), { recursive: true });
    await Promise.all(
      Array.from({ length: spec.frames }, (_, column) =>
        writeFile(
          join(root, state, `${column}.png`),
          column === representativeColumn ? buffer : blue,
        ),
      ),
    );
  }
  await mkdir(join(root, "look"), { recursive: true });
  await Promise.all(
    Array.from({ length: 16 }, (_, direction) =>
      writeFile(
        join(root, "look", `${direction}.png`),
        direction === 0 ? red : direction === 8 ? green : blue,
      ),
    ),
  );

  await createContactSheet(root, output);
  const metadata = await sharp(output).metadata();
  expect(metadata).toMatchObject({
    format: "png",
    width: PET_SPEC.sheetWidth,
    height: PET_SPEC.sheetHeight,
  });

  expect(stateSamples.every(({ column }) => column > 0)).toBe(true);
  expect(new Set(stateSamples.map(({ color }) => color.join(","))).size).toBe(
    Object.keys(STATES).length,
  );
  for (const { spec, column, color } of stateSamples) {
    const rendered = await sharp(output)
      .extract({
        left: column * PET_SPEC.cellWidth,
        top: spec.row * PET_SPEC.cellHeight,
        width: 1,
        height: 1,
      })
      .raw()
      .toBuffer();
    expect([...rendered.subarray(0, 3)]).toEqual([...color]);
  }

  const firstRow = await sharp(output)
    .extract({
      left: 0,
      top: (PET_SPEC.rows - 2) * PET_SPEC.cellHeight,
      width: 1,
      height: 1,
    })
    .raw()
    .toBuffer();
  const secondRow = await sharp(output)
    .extract({
      left: 0,
      top: (PET_SPEC.rows - 1) * PET_SPEC.cellHeight,
      width: 1,
      height: 1,
    })
    .raw()
    .toBuffer();
  expect([...firstRow.subarray(0, 3)]).toEqual([255, 0, 0]);
  expect([...secondRow.subarray(0, 3)]).toEqual([0, 255, 0]);
  expect(await readFile(output)).not.toHaveLength(0);
});

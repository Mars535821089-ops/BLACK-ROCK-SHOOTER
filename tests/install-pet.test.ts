import { afterEach, describe, expect, it } from "vitest";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { installPet } from "../src/install-pet.js";

const root = "tests/fixtures/install";

afterEach(() => rm(root, { recursive: true, force: true }));

describe("installPet", () => {
  it("replaces only its own slug and keeps a backup", async () => {
    await mkdir(`${root}/source`, { recursive: true });
    await mkdir(`${root}/pets/blueflame`, { recursive: true });
    await mkdir(`${root}/pets/other-pet`, { recursive: true });
    await writeFile(`${root}/source/pet.json`, "new");
    await writeFile(`${root}/source/spritesheet.webp`, "sheet");
    await writeFile(`${root}/pets/blueflame/pet.json`, "old");
    await writeFile(`${root}/pets/other-pet/keep`, "safe");

    const result = await installPet({
      sourceDir: `${root}/source`,
      petsRoot: `${root}/pets`,
      slug: "blueflame",
      validate: async () => undefined,
    });

    expect(await readFile(`${root}/pets/blueflame/pet.json`, "utf8")).toBe("new");
    expect(await readFile(`${root}/pets/other-pet/keep`, "utf8")).toBe("safe");
    expect(result.backupPath).toContain("blueflame.backup-");
  });

  it("keeps the current pet and removes staging when validation fails", async () => {
    await mkdir(`${root}/source`, { recursive: true });
    await mkdir(`${root}/pets/blueflame`, { recursive: true });
    await writeFile(`${root}/source/pet.json`, "invalid");
    await writeFile(`${root}/pets/blueflame/pet.json`, "current");

    await expect(
      installPet({
        sourceDir: `${root}/source`,
        petsRoot: `${root}/pets`,
        slug: "blueflame",
        validate: async () => {
          throw new Error("invalid pet");
        },
      }),
    ).rejects.toThrow("invalid pet");

    expect(await readFile(`${root}/pets/blueflame/pet.json`, "utf8")).toBe("current");
    await expect(access(`${root}/pets/.blueflame.staging`)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects a slug that could escape its own target directory", async () => {
    await mkdir(`${root}/source`, { recursive: true });
    await mkdir(`${root}/pets/other-pet`, { recursive: true });
    await writeFile(`${root}/source/pet.json`, "new");
    await writeFile(`${root}/pets/other-pet/pet.json`, "safe");

    await expect(
      installPet({
        sourceDir: `${root}/source`,
        petsRoot: `${root}/pets`,
        slug: "../other-pet",
        validate: async () => undefined,
      }),
    ).rejects.toThrow("Invalid pet slug");

    expect(await readFile(`${root}/pets/other-pet/pet.json`, "utf8")).toBe("safe");
  });
});

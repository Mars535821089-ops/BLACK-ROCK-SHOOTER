import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createPackage, extractFile, getRawHeader } from "@electron/asar";
import { afterEach, describe, expect, test } from "vitest";
import {
  EXPECTED_APP_VERSION,
  EXPECTED_PATCHED_ASAR_SHA256,
  EXPECTED_PATCHED_HEADER_SHA256,
  PATCH_TARGETS,
  assertExpectedVersion,
  backupBundleFiles,
  inspectArchive,
  patchArchiveInPlace,
  restoreBundleFiles,
  verifyArchive,
  verifyArchiveIntegrity,
} from "../src/native-pet-patch.js";

const temporaryDirectories: string[] = [];

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "codex-pet-patch-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function writeFixtureFile(root: string, path: string, content: string) {
  const destination = join(root, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, content);
}

async function createOriginalArchive(options?: {
  omitTarget?: string;
  prepatchTarget?: string;
}) {
  const root = await temporaryDirectory();
  const source = join(root, "source");
  const archive = join(root, "app.asar");

  for (const target of PATCH_TARGETS) {
    if (target.path === options?.omitTarget) continue;
    const original = target.replacements
      .map(({ before, count }) => Array(count).fill(before).join("\n"))
      .join("\n");
    const content =
      target.path === options?.prepatchTarget
        ? target.replacements.reduce(
            (value, replacement) =>
              value.split(replacement.before).join(replacement.after),
            original,
          )
        : original;
    await writeFixtureFile(source, target.path, content);
  }

  await createPackage(source, archive);
  return { archive, root };
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("native Pet ASAR patch", () => {
  test("pins the exact patched hashes for Codex 26.707.72221", () => {
    expect(EXPECTED_PATCHED_ASAR_SHA256).toBe(
      "2d8ff6b09ae040f58cf796f68b8b820e4d5965aaac61a5ac20ec6ac982279f69",
    );
    expect(EXPECTED_PATCHED_HEADER_SHA256).toBe(
      "fb065e6ef3792855e4baf20b37e0a41676c78eb0cb02a948d421dc3003ffb392",
    );
  });
  test("patches every exact 224 limit and preserves packed file sizes", async () => {
    const { archive } = await createOriginalArchive();
    const sizesBefore = new Map(
      PATCH_TARGETS.map((target) => [
        target.path,
        extractFile(archive, target.path).byteLength,
      ]),
    );

    const result = await patchArchiveInPlace(archive);

    expect(result.stateBefore).toBe("original");
    expect(result.stateAfter).toBe("patched");
    expect(result.replacementCount).toBe(10);
    for (const target of PATCH_TARGETS) {
      const content = extractFile(archive, target.path).toString("utf8");
      expect(extractFile(archive, target.path).byteLength).toBe(
        sizesBefore.get(target.path),
      );
      for (const replacement of target.replacements) {
        expect(content).not.toContain(replacement.before);
        expect(content.split(replacement.after)).toHaveLength(
          replacement.count + 1,
        );
      }
    }
  });

  test("updates per-file integrity and returns the new ASAR header hash", async () => {
    const { archive } = await createOriginalArchive();
    const before = getRawHeader(archive);

    const result = await patchArchiveInPlace(archive);
    const after = getRawHeader(archive);

    expect(result.headerHash).toBe(
      createHash("sha256").update(after.headerString).digest("hex"),
    );
    expect(result.headerHash).not.toBe(
      createHash("sha256").update(before.headerString).digest("hex"),
    );
    expect(() => PATCH_TARGETS.map((target) => extractFile(archive, target.path))).not.toThrow();
    await expect(verifyArchiveIntegrity(archive)).resolves.toMatchObject({
      filesVerified: PATCH_TARGETS.length,
    });
  });

  test("rejects target corruption even when replacement strings still match", async () => {
    const { archive } = await createOriginalArchive();
    await patchArchiveInPlace(archive);
    const bytes = await readFile(archive);
    const raw = getRawHeader(archive);
    const target = PATCH_TARGETS[0]!;
    let node: any = raw.header;
    for (const component of target.path.split("/")) node = node.files[component];
    const contentOffset = 8 + raw.headerSize + Number(node.offset);
    bytes[contentOffset] = bytes[contentOffset]! ^ 1;
    await writeFile(archive, bytes);

    await expect(verifyArchiveIntegrity(archive)).rejects.toThrow(/integrity/i);
  });

  test("is idempotent for an already-patched archive", async () => {
    const { archive } = await createOriginalArchive();
    await patchArchiveInPlace(archive);
    const hashBefore = createHash("sha256")
      .update(await readFile(archive))
      .digest("hex");

    const result = await patchArchiveInPlace(archive);

    expect(result.stateBefore).toBe("patched");
    expect(result.replacementCount).toBe(0);
    expect(createHash("sha256").update(await readFile(archive)).digest("hex")).toBe(
      hashBefore,
    );
  });

  test("rejects partial patches without changing the archive", async () => {
    const { archive } = await createOriginalArchive({
      prepatchTarget: PATCH_TARGETS[0]!.path,
    });
    const before = await readFile(archive);

    await expect(patchArchiveInPlace(archive)).rejects.toThrow(/partial/i);
    expect(await readFile(archive)).toEqual(before);
  });

  test("rejects unexpected strings or missing target files", async () => {
    const { archive } = await createOriginalArchive({
      omitTarget: PATCH_TARGETS[0]!.path,
    });

    await expect(patchArchiveInPlace(archive)).rejects.toThrow(/unexpected/i);
  });

  test("verify reports original, patched, partial, and unexpected states", async () => {
    const original = await createOriginalArchive();
    expect((await inspectArchive(original.archive)).state).toBe("original");
    await patchArchiveInPlace(original.archive);
    await expect(verifyArchive(original.archive)).resolves.toMatchObject({
      state: "patched",
    });

    const partial = await createOriginalArchive({
      prepatchTarget: PATCH_TARGETS[0]!.path,
    });
    expect((await inspectArchive(partial.archive)).state).toBe("partial");

    const unexpected = await createOriginalArchive({
      omitTarget: PATCH_TARGETS[0]!.path,
    });
    expect((await inspectArchive(unexpected.archive)).state).toBe("unexpected");
  });

  test("checks the exact supported Codex version", () => {
    expect(() => assertExpectedVersion(EXPECTED_APP_VERSION)).not.toThrow();
    expect(() => assertExpectedVersion("26.708.00000")).toThrow(/unsupported/i);
  });

  test("backs up and restores ASAR, plist, and signature metadata", async () => {
    const root = await temporaryDirectory();
    const app = join(root, "ChatGPT.app");
    const resources = join(app, "Contents/Resources");
    const signature = join(app, "Contents/_CodeSignature");
    const backup = join(root, "backup");
    await mkdir(resources, { recursive: true });
    await mkdir(signature, { recursive: true });
    await writeFile(join(resources, "app.asar"), "original asar");
    await writeFile(join(app, "Contents/Info.plist"), "original plist");
    await writeFile(join(signature, "CodeResources"), "original signature");

    await backupBundleFiles(app, backup);
    await writeFile(join(resources, "app.asar"), "patched asar");
    await writeFile(join(app, "Contents/Info.plist"), "patched plist");
    await writeFile(join(signature, "CodeResources"), "patched signature");
    await restoreBundleFiles(app, backup);

    expect(await readFile(join(resources, "app.asar"), "utf8")).toBe("original asar");
    expect(await readFile(join(app, "Contents/Info.plist"), "utf8")).toBe("original plist");
    expect(await readFile(join(signature, "CodeResources"), "utf8")).toBe(
      "original signature",
    );
  });
});

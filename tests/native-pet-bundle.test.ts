import { access, cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  NativePetBundlePatcher,
  runNativePetPatcherCommand,
  type BundleBackend,
  type BundleInfo,
  type ExpectedBundleHashes,
} from "../src/native-pet-bundle.js";

const roots: string[] = [];
const expected: ExpectedBundleHashes = {
  version: "26.707.72221",
  originalAsarHash: "original-asar",
  originalHeaderHash: "original-header",
  patchedAsarHash: "patched-asar",
  patchedHeaderHash: "patched-header",
  originalAuthority: "Developer ID Application: OpenAI OpCo, LLC (2DC432GLL2)",
  originalTeamIdentifier: "2DC432GLL2",
};

const originalTrust = {
  signature: "developer-id" as const,
  authority: expected.originalAuthority,
  teamIdentifier: expected.originalTeamIdentifier,
  notarizationStapled: true,
  codeValidOnDisk: true,
  designatedRequirementSatisfied: true,
  gatekeeper: "accepted" as const,
  gatekeeperSource: "Notarized Developer ID",
};

const stagedTrust = {
  signature: "adhoc" as const,
  authority: null,
  teamIdentifier: null,
  notarizationStapled: true,
  codeValidOnDisk: true,
  designatedRequirementSatisfied: false,
  gatekeeper: "rejected" as const,
  gatekeeperSource: null,
};

async function tempRoot() {
  const root = await mkdtemp(join(tmpdir(), "native-pet-bundle-"));
  roots.push(root);
  return root;
}

async function writeBundle(path: string, info: BundleInfo) {
  await mkdir(path, { recursive: true });
  await writeFile(join(path, "bundle-state.json"), JSON.stringify(info));
}

class FixtureBackend implements BundleBackend {
  running = false;
  mutationCount = 0;
  failNextPostSwapVerification = false;
  failRollbackRename = false;

  async inspect(path: string): Promise<BundleInfo> {
    if (this.failNextPostSwapVerification && path.endsWith("Live.app")) {
      this.failNextPostSwapVerification = false;
      throw new Error("post-swap verification failed");
    }
    return JSON.parse(await readFile(join(path, "bundle-state.json"), "utf8"));
  }
  async bundleExists(path: string) {
    return access(path).then(
      () => true,
      () => false,
    );
  }
  async copyBundle(source: string, destination: string) {
    this.mutationCount += 1;
    await cp(source, destination, { recursive: true });
  }
  async removeBundle(path: string) {
    this.mutationCount += 1;
    await rm(path, { recursive: true, force: true });
  }
  async renameBundle(source: string, destination: string) {
    this.mutationCount += 1;
    if (this.failRollbackRename && source.includes(".displaced-")) {
      throw Object.assign(new Error("rollback rename failed"), { code: "EACCES" });
    }
    await mkdir(dirname(destination), { recursive: true });
    await rename(source, destination);
  }
  async patchBundle(path: string) {
    this.mutationCount += 1;
    const info = await this.inspect(path);
    await writeBundle(path, {
      ...info,
      archiveState: "patched",
      asarHash: expected.patchedAsarHash,
      headerHash: expected.patchedHeaderHash,
      recordedHeaderHash: expected.patchedHeaderHash,
      targetIntegrityValid: true,
    });
  }
  async signForensicStage(path: string) {
    this.mutationCount += 1;
    const info = await this.inspect(path);
    await writeBundle(path, { ...info, trust: stagedTrust });
  }
  async isAppRunning() {
    return this.running;
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture() {
  const root = await tempRoot();
  const live = join(root, "Live.app");
  const stage = join(root, "ChatGPT-patched.app");
  const backup = join(root, "Backup.app");
  await writeBundle(live, {
    version: expected.version,
    archiveState: "original",
    asarHash: expected.originalAsarHash,
    headerHash: expected.originalHeaderHash,
    recordedHeaderHash: expected.originalHeaderHash,
    targetIntegrityValid: true,
    trust: originalTrust,
  });
  const backend = new FixtureBackend();
  const patcher = new NativePetBundlePatcher(backend, expected);
  return { root, live, stage, backup, backend, patcher };
}

describe("native Pet bundle CLI semantics", () => {
  test("verifies an exact original bundle", async () => {
    const { live, patcher } = await fixture();
    await expect(
      runNativePetPatcherCommand(
        ["verify", "--app", live, "--mode", "original"],
        patcher,
      ),
    ).resolves.toMatchObject({
      classification: "original-trusted",
    });
  });

  test("stage succeeds as content-valid but explicitly untrusted", async () => {
    const { live, stage, backup, patcher } = await fixture();
    const result = await runNativePetPatcherCommand(
      ["stage", "--app", live, "--output", stage, "--backup", backup],
      patcher,
    );
    expect(result).toMatchObject({ classification: "patched-staged-untrusted" });
    await expect(
      runNativePetPatcherCommand(
        ["verify", "--app", stage, "--mode", "patched-staged"],
        patcher,
      ),
    ).resolves.toMatchObject({ classification: "patched-staged-untrusted" });
    await expect(patcher.verify(backup, "original")).resolves.toBeDefined();
  });

  test("staging is idempotent when the forensic bundle is already exact", async () => {
    const { live, stage, backup, backend, patcher } = await fixture();
    await patcher.stage(live, stage, backup);
    const mutations = backend.mutationCount;
    const second = await patcher.stage(live, stage, backup);
    expect(second.reused).toBe(true);
    expect(backend.mutationCount).toBe(mutations);
  });

  test("stage refuses an existing invalid backup without overwriting it", async () => {
    const { live, stage, backup, backend, patcher } = await fixture();
    const liveInfo = JSON.parse(await readFile(join(live, "bundle-state.json"), "utf8"));
    await writeBundle(backup, { ...liveInfo, asarHash: "corrupt-backup" });
    const backupBefore = await readFile(join(backup, "bundle-state.json"), "utf8");
    const mutations = backend.mutationCount;
    await expect(patcher.stage(live, stage, backup)).rejects.toThrow(/backup/i);
    expect(backend.mutationCount).toBe(mutations);
    expect(await readFile(join(backup, "bundle-state.json"), "utf8")).toBe(
      backupBefore,
    );
  });

  test("patched-staged rejects any trust failure other than the known blocker", async () => {
    const { live, stage, backup, patcher } = await fixture();
    await patcher.stage(live, stage, backup);
    const info = JSON.parse(await readFile(join(stage, "bundle-state.json"), "utf8"));
    await writeBundle(stage, {
      ...info,
      trust: { ...stagedTrust, codeValidOnDisk: false },
    });
    await expect(patcher.verify(stage, "patched-staged")).rejects.toThrow(/trust/i);
  });

  test("patched-staged rejects any extra ASAR alteration", async () => {
    const { live, stage, backup, patcher } = await fixture();
    await patcher.stage(live, stage, backup);
    const info = JSON.parse(await readFile(join(stage, "bundle-state.json"), "utf8"));
    await writeBundle(stage, { ...info, asarHash: "patched-asar-plus-extra-byte" });
    await expect(patcher.verify(stage, "patched-staged")).rejects.toThrow(
      /patched ASAR hash/i,
    );
  });

  test("live-safe apply refuses before mutation", async () => {
    const { live, stage, backup, backend, patcher } = await fixture();
    await patcher.stage(live, stage, backup);
    const liveBefore = await readFile(join(live, "bundle-state.json"), "utf8");
    const mutations = backend.mutationCount;
    await expect(
      runNativePetPatcherCommand(
        [
          "apply",
          "--app",
          live,
          "--staged",
          stage,
          "--backup",
          backup,
        ],
        patcher,
      ),
    ).rejects.toThrow(/live-safe/i);
    expect(backend.mutationCount).toBe(mutations);
    expect(await readFile(join(live, "bundle-state.json"), "utf8")).toBe(liveBefore);
  });

  test("whole-bundle restore replaces a stopped app with the verified original", async () => {
    const { live, stage, backup, patcher } = await fixture();
    await patcher.stage(live, stage, backup);
    await rm(live, { recursive: true, force: true });
    await cp(stage, live, { recursive: true });
    await runNativePetPatcherCommand(
      ["restore", "--app", live, "--backup", backup],
      patcher,
    );
    await expect(patcher.verify(live, "original")).resolves.toBeDefined();
  });

  test("post-swap failure restores displaced original into an empty app path", async () => {
    const { live, stage, backup, backend, patcher } = await fixture();
    await patcher.stage(live, stage, backup);
    backend.failNextPostSwapVerification = true;
    await expect(patcher.restore(live, backup)).rejects.toThrow(/post-swap/i);
    await expect(patcher.verify(live, "original")).resolves.toBeDefined();
  });

  test("apply uses the same rollback path after a post-swap failure", async () => {
    const { live, stage, backup, backend, patcher } = await fixture();
    await patcher.stage(live, stage, backup);
    const info = JSON.parse(await readFile(join(stage, "bundle-state.json"), "utf8"));
    await writeBundle(stage, { ...info, trust: originalTrust });
    backend.failNextPostSwapVerification = true;
    await expect(patcher.apply(live, stage, backup)).rejects.toThrow(/post-swap/i);
    await expect(patcher.verify(live, "original")).resolves.toBeDefined();
  });

  test("rollback failures are surfaced as an aggregate error", async () => {
    const { live, backup, backend, patcher } = await fixture();
    await cp(live, backup, { recursive: true });
    backend.failNextPostSwapVerification = true;
    backend.failRollbackRename = true;
    await expect(patcher.restore(live, backup)).rejects.toBeInstanceOf(
      AggregateError,
    );
  });
});

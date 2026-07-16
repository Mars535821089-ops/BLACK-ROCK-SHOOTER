import { basename, dirname, join } from "node:path";

export type VerifyMode = "original" | "patched-staged" | "live-safe";

export type TrustEvidence = {
  signature: "developer-id" | "adhoc" | "unknown";
  authority: string | null;
  teamIdentifier: string | null;
  notarizationStapled: boolean;
  codeValidOnDisk: boolean;
  designatedRequirementSatisfied: boolean;
  gatekeeper: "accepted" | "rejected" | "error";
  gatekeeperSource: string | null;
};

export type BundleInfo = {
  version: string;
  archiveState: "original" | "patched" | "partial" | "unexpected";
  asarHash: string;
  headerHash: string;
  recordedHeaderHash: string;
  targetIntegrityValid: boolean;
  trust: TrustEvidence;
};

export type ExpectedBundleHashes = {
  version: string;
  originalAsarHash: string;
  originalHeaderHash: string;
  patchedAsarHash: string;
  patchedHeaderHash: string;
  originalAuthority: string;
  originalTeamIdentifier: string;
};

export interface BundleBackend {
  inspect(path: string): Promise<BundleInfo>;
  bundleExists(path: string): Promise<boolean>;
  copyBundle(source: string, destination: string): Promise<void>;
  removeBundle(path: string): Promise<void>;
  renameBundle(source: string, destination: string): Promise<void>;
  patchBundle(path: string): Promise<void>;
  signForensicStage(path: string): Promise<void>;
  isAppRunning(): Promise<boolean>;
}

type VerificationResult = BundleInfo & {
  mode: VerifyMode;
  classification:
    | "original-trusted"
    | "patched-staged-untrusted"
    | "live-safe";
};

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label} mismatch: ${String(actual)} != ${String(expected)}`);
  }
}

export class NativePetBundlePatcher {
  constructor(
    private readonly backend: BundleBackend,
    private readonly expected: ExpectedBundleHashes,
  ) {}

  private assertOriginalTrust(trust: TrustEvidence) {
    const valid =
      trust.signature === "developer-id" &&
      trust.authority === this.expected.originalAuthority &&
      trust.teamIdentifier === this.expected.originalTeamIdentifier &&
      trust.notarizationStapled &&
      trust.codeValidOnDisk &&
      trust.designatedRequirementSatisfied &&
      trust.gatekeeper === "accepted" &&
      trust.gatekeeperSource === "Notarized Developer ID";
    if (!valid) throw new Error("Original Developer ID trust verification failed");
  }

  private assertKnownStagedTrust(trust: TrustEvidence) {
    const knownBlocker =
      trust.signature === "adhoc" &&
      trust.authority == null &&
      trust.teamIdentifier == null &&
      trust.codeValidOnDisk &&
      !trust.designatedRequirementSatisfied &&
      trust.gatekeeper === "rejected" &&
      trust.gatekeeperSource == null;
    if (!knownBlocker) {
      throw new Error(
        "Patched-staged trust does not match the known ad-hoc designated-requirement blocker",
      );
    }
  }

  async verify(path: string, mode: VerifyMode): Promise<VerificationResult> {
    const info = await this.backend.inspect(path);
    assertEqual(info.version, this.expected.version, "version");
    if (!info.targetIntegrityValid) {
      throw new Error("Target ASAR integrity verification failed");
    }
    assertEqual(info.recordedHeaderHash, info.headerHash, "recorded ASAR header");

    if (mode === "original") {
      assertEqual(info.archiveState, "original", "archive state");
      assertEqual(info.asarHash, this.expected.originalAsarHash, "original ASAR hash");
      assertEqual(
        info.headerHash,
        this.expected.originalHeaderHash,
        "original ASAR header hash",
      );
      this.assertOriginalTrust(info.trust);
      return { ...info, mode, classification: "original-trusted" };
    }

    assertEqual(info.archiveState, "patched", "archive state");
    assertEqual(info.asarHash, this.expected.patchedAsarHash, "patched ASAR hash");
    assertEqual(
      info.headerHash,
      this.expected.patchedHeaderHash,
      "patched ASAR header hash",
    );
    if (mode === "patched-staged") {
      this.assertKnownStagedTrust(info.trust);
      return { ...info, mode, classification: "patched-staged-untrusted" };
    }
    this.assertOriginalTrust(info.trust);
    return { ...info, mode, classification: "live-safe" };
  }

  private async verifyOrNull(path: string, mode: VerifyMode) {
    try {
      return await this.verify(path, mode);
    } catch {
      return null;
    }
  }

  private async detectTrustedState(path: string) {
    const errors: unknown[] = [];
    try {
      return await this.verify(path, "live-safe");
    } catch (error) {
      errors.push(error);
    }
    try {
      return await this.verify(path, "original");
    } catch (error) {
      errors.push(error);
    }
    throw new AggregateError(
      errors,
      "Current app is neither live-safe nor original-trusted",
    );
  }

  private assertDistinctPaths(...paths: string[]) {
    if (new Set(paths).size !== paths.length) {
      throw new Error("App, staging, and backup paths must be distinct");
    }
  }

  async stage(appPath: string, outputPath: string, backupPath: string) {
    this.assertDistinctPaths(appPath, outputPath, backupPath);
    if (basename(outputPath) !== "ChatGPT-patched.app") {
      throw new Error("Unsafe staging path: expected ChatGPT-patched.app");
    }
    await this.verify(appPath, "original");

    if (await this.backend.bundleExists(backupPath)) {
      try {
        await this.verify(backupPath, "original");
      } catch (error) {
        throw new Error("Existing backup failed original verification", {
          cause: error,
        });
      }
    } else {
      await this.backend.copyBundle(appPath, backupPath);
      await this.verify(backupPath, "original");
    }

    const existingStage = await this.verifyOrNull(outputPath, "patched-staged");
    if (existingStage) return { ...existingStage, reused: true };
    await this.backend.removeBundle(outputPath);

    await this.backend.copyBundle(appPath, outputPath);
    await this.backend.patchBundle(outputPath);
    await this.backend.signForensicStage(outputPath);
    const verified = await this.verify(outputPath, "patched-staged");
    return { ...verified, reused: false };
  }

  async apply(appPath: string, stagedPath: string, backupPath: string) {
    if (await this.backend.isAppRunning()) {
      throw new Error(
        "BLOCKED: ChatGPT is running. Quit it manually; the patcher never quits it.",
      );
    }
    this.assertDistinctPaths(appPath, stagedPath, backupPath);
    const current = await this.detectTrustedState(appPath);
    if (current.mode === "live-safe") {
      return { ...current, reused: true };
    }
    // Mandatory no-mutation gate. The forensic ad-hoc stage fails here.
    try {
      await this.verify(stagedPath, "live-safe");
    } catch (error) {
      throw new Error(
        `LIVE-SAFE verification failed before mutation: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
    if (await this.backend.bundleExists(backupPath)) {
      await this.verify(backupPath, "original");
    } else {
      await this.backend.copyBundle(appPath, backupPath);
      await this.verify(backupPath, "original");
    }
    const replacement = join(
      dirname(appPath),
      `.${basename(appPath)}.apply-${Date.now()}`,
    );
    await this.backend.copyBundle(stagedPath, replacement);
    const applied = await this.swapVerified(appPath, replacement, "live-safe");
    return { ...applied, reused: false };
  }

  async restore(appPath: string, backupPath: string) {
    this.assertDistinctPaths(appPath, backupPath);
    if (await this.backend.isAppRunning()) {
      throw new Error(
        "BLOCKED: ChatGPT is running. Quit it manually; the patcher never quits it.",
      );
    }
    await this.verify(backupPath, "original");
    const replacement = join(
      dirname(appPath),
      `.${basename(appPath)}.restore-${Date.now()}`,
    );
    await this.backend.removeBundle(replacement);
    await this.backend.copyBundle(backupPath, replacement);
    return this.swapVerified(appPath, replacement, "original");
  }

  private async swapVerified(
    appPath: string,
    replacementPath: string,
    mode: VerifyMode,
  ) {
    const prior = await this.detectTrustedState(appPath);
    const displaced = `${appPath}.displaced-${Date.now()}`;
    const failed = `${appPath}.failed-${Date.now()}`;
    await this.backend.renameBundle(appPath, displaced);
    try {
      await this.backend.renameBundle(replacementPath, appPath);
      const verified = await this.verify(appPath, mode);
      await this.backend.removeBundle(displaced);
      return verified;
    } catch (swapError) {
      const rollbackErrors: unknown[] = [];
      try {
        await this.backend.renameBundle(appPath, failed);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          rollbackErrors.push(error);
        }
      }
      try {
        await this.backend.renameBundle(displaced, appPath);
      } catch (error) {
        rollbackErrors.push(error);
      }
      try {
        const restored = await this.verify(appPath, prior.mode);
        assertEqual(restored.asarHash, prior.asarHash, "rollback ASAR hash");
        assertEqual(restored.headerHash, prior.headerHash, "rollback header hash");
        assertEqual(
          restored.recordedHeaderHash,
          prior.recordedHeaderHash,
          "rollback recorded header hash",
        );
      } catch (error) {
        rollbackErrors.push(error);
      }
      try {
        await this.backend.removeBundle(failed);
      } catch (error) {
        rollbackErrors.push(error);
      }
      if (rollbackErrors.length > 0) {
        throw new AggregateError(
          [swapError, ...rollbackErrors],
          "Post-swap failure and rollback did not complete cleanly",
        );
      }
      throw swapError;
    }
  }
}

function argument(args: string[], name: string) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

export async function runNativePetPatcherCommand(
  args: string[],
  patcher: NativePetBundlePatcher,
) {
  const command = args[0];
  const app = argument(args, "--app");
  if (!app) throw new Error("Missing --app");
  if (command === "verify") {
    const mode = argument(args, "--mode") as VerifyMode | undefined;
    if (!mode) throw new Error("Missing --mode");
    return patcher.verify(app, mode);
  }
  const backup = argument(args, "--backup");
  if (!backup) throw new Error("Missing --backup");
  if (command === "stage") {
    const output = argument(args, "--output");
    if (!output) throw new Error("Missing --output");
    return patcher.stage(app, output, backup);
  }
  if (command === "apply") {
    const staged = argument(args, "--staged");
    if (!staged) throw new Error("Missing --staged");
    return patcher.apply(app, staged, backup);
  }
  if (command === "restore") return patcher.restore(app, backup);
  throw new Error(`Unknown command ${String(command)}`);
}

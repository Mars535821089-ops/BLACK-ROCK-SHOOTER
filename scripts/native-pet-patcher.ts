#!/usr/bin/env tsx
import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { readFile, rename, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { getRawHeader } from "@electron/asar";
import {
  NativePetBundlePatcher,
  runNativePetPatcherCommand,
  type BundleBackend,
  type BundleInfo,
  type ExpectedBundleHashes,
  type TrustEvidence,
  type VerifyMode,
} from "../src/native-pet-bundle.js";
import {
  EXPECTED_APP_VERSION,
  EXPECTED_ORIGINAL_ASAR_SHA256,
  EXPECTED_ORIGINAL_HEADER_SHA256,
  EXPECTED_PATCHED_ASAR_SHA256,
  EXPECTED_PATCHED_HEADER_SHA256,
  inspectArchive,
  patchArchiveInPlace,
  verifyArchiveIntegrity,
} from "../src/native-pet-patch.js";

const execFile = promisify(execFileCallback);
const originalAuthority =
  "Developer ID Application: OpenAI OpCo, LLC (2DC432GLL2)";
const expected: ExpectedBundleHashes = {
  version: EXPECTED_APP_VERSION,
  originalAsarHash: EXPECTED_ORIGINAL_ASAR_SHA256,
  originalHeaderHash: EXPECTED_ORIGINAL_HEADER_SHA256,
  patchedAsarHash: EXPECTED_PATCHED_ASAR_SHA256,
  patchedHeaderHash: EXPECTED_PATCHED_HEADER_SHA256,
  originalAuthority,
  originalTeamIdentifier: "2DC432GLL2",
};
const defaultApp = "/Applications/ChatGPT.app";
const defaultStage = resolve("work/task-11/ChatGPT-patched.app");
const defaultBackup = join(
  homedir(),
  "Library/Application Support/CodexPetPatcher/backups",
  `${EXPECTED_APP_VERSION}-original`,
  "ChatGPT.app",
);

type CommandResult = { exitCode: number; output: string };

async function run(file: string, args: string[]): Promise<CommandResult> {
  try {
    const result = await execFile(file, args);
    return { exitCode: 0, output: `${result.stdout}${result.stderr}` };
  } catch (error) {
    const commandError = error as NodeJS.ErrnoException & {
      code?: number | string;
      stdout?: string;
      stderr?: string;
    };
    return {
      exitCode: typeof commandError.code === "number" ? commandError.code : 1,
      output: `${commandError.stdout ?? ""}${commandError.stderr ?? ""}`,
    };
  }
}

function match(output: string, expression: RegExp) {
  return output.match(expression)?.[1]?.trim() ?? null;
}

async function trustEvidence(appPath: string): Promise<TrustEvidence> {
  const display = await run("/usr/bin/codesign", ["-dvvv", "--verbose=4", appPath]);
  const signature = display.output.includes("Signature=adhoc")
    ? "adhoc"
    : display.output.includes("Authority=")
      ? "developer-id"
      : "unknown";
  const verify = await run("/usr/bin/codesign", [
    "--verify",
    "--deep",
    "--strict",
    "--verbose=4",
    appPath,
  ]);
  const gatekeeper = await run("/usr/sbin/spctl", [
    "--assess",
    "--type",
    "execute",
    "--verbose=4",
    appPath,
  ]);
  const codeValidOnDisk =
    verify.exitCode === 0 || verify.output.includes("valid on disk");
  const designatedRequirementSatisfied =
    verify.exitCode === 0 &&
    !verify.output.includes("does not satisfy its designated Requirement");
  return {
    signature,
    authority: match(display.output, /^Authority=(Developer ID Application:.*)$/m),
    teamIdentifier:
      match(display.output, /^TeamIdentifier=(.*)$/m) === "not set"
        ? null
        : match(display.output, /^TeamIdentifier=(.*)$/m),
    notarizationStapled: display.output.includes("Notarization Ticket=stapled"),
    codeValidOnDisk,
    designatedRequirementSatisfied,
    gatekeeper:
      gatekeeper.exitCode === 0
        ? "accepted"
        : gatekeeper.output.includes("rejected")
          ? "rejected"
          : "error",
    gatekeeperSource: match(gatekeeper.output, /^source=(.*)$/m),
  };
}

async function sha256(path: string) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function plistValue(plist: string, key: string) {
  const result = await run("/usr/bin/plutil", ["-extract", key, "raw", plist]);
  if (result.exitCode !== 0) throw new Error(result.output);
  return result.output.trim();
}

async function updateRecordedHeaderHash(plist: string, hash: string) {
  const result = await run("/usr/libexec/PlistBuddy", [
    "-c",
    `Set :ElectronAsarIntegrity:Resources/app.asar:hash ${hash}`,
    plist,
  ]);
  if (result.exitCode !== 0) throw new Error(result.output);
}

class MacBundleBackend implements BundleBackend {
  async inspect(appPath: string): Promise<BundleInfo> {
    const plist = join(appPath, "Contents/Info.plist");
    const asar = join(appPath, "Contents/Resources/app.asar");
    const rawHeader = getRawHeader(asar);
    const headerHash = createHash("sha256")
      .update(rawHeader.headerString)
      .digest("hex");
    let targetIntegrityValid = true;
    try {
      await verifyArchiveIntegrity(asar);
    } catch {
      targetIntegrityValid = false;
    }
    return {
      version: await plistValue(plist, "CFBundleShortVersionString"),
      archiveState: (await inspectArchive(asar)).state,
      asarHash: await sha256(asar),
      headerHash,
      recordedHeaderHash: await plistValue(
        plist,
        "ElectronAsarIntegrity.Resources/app\\.asar.hash",
      ),
      targetIntegrityValid,
      trust: await trustEvidence(appPath),
    };
  }

  async bundleExists(path: string) {
    return stat(path).then(
      () => true,
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return false;
        throw error;
      },
    );
  }

  async copyBundle(source: string, destination: string) {
    const result = await run("/usr/bin/ditto", [source, destination]);
    if (result.exitCode !== 0) throw new Error(result.output);
  }
  async removeBundle(path: string) {
    await rm(path, { recursive: true, force: true });
  }
  async renameBundle(source: string, destination: string) {
    await rename(source, destination);
  }
  async patchBundle(appPath: string) {
    const asar = join(appPath, "Contents/Resources/app.asar");
    const result = await patchArchiveInPlace(asar);
    if (result.headerHash !== EXPECTED_PATCHED_HEADER_SHA256) {
      throw new Error(`Unexpected patched header hash ${result.headerHash}`);
    }
    if ((await sha256(asar)) !== EXPECTED_PATCHED_ASAR_SHA256) {
      throw new Error("Unexpected patched whole-ASAR hash");
    }
    await verifyArchiveIntegrity(asar);
    await updateRecordedHeaderHash(
      join(appPath, "Contents/Info.plist"),
      result.headerHash,
    );
  }
  async signForensicStage(appPath: string) {
    const result = await run("/usr/bin/codesign", [
      "--force",
      "--sign",
      "-",
      "--preserve-metadata=entitlements,requirements,flags,runtime",
      appPath,
    ]);
    if (result.exitCode !== 0) throw new Error(result.output);
  }
  async isAppRunning() {
    return (await run("/usr/bin/pgrep", ["-x", "ChatGPT"])).exitCode === 0;
  }
}

function option(name: string, fallback?: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

async function main() {
  const command = process.argv[2];
  const app = resolve(option("--app", defaultApp)!);
  const backend = new MacBundleBackend();
  const patcher = new NativePetBundlePatcher(backend, expected);
  if (command === "analyze") {
    console.log(JSON.stringify(await backend.inspect(app), null, 2));
    return;
  }
  const args = [command, "--app", app];
  if (command === "verify") {
    args.push("--mode", option("--mode", "original") as VerifyMode);
  } else {
    args.push("--backup", resolve(option("--backup", defaultBackup)!));
  }
  if (command === "stage") {
    args.push("--output", resolve(option("--output", defaultStage)!));
  }
  if (command === "apply") {
    args.push("--staged", resolve(option("--staged", defaultStage)!));
  }
  const result = await runNativePetPatcherCommand(args, patcher);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

#!/usr/bin/env tsx
import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { getRawHeader } from "@electron/asar";
import {
  EXPECTED_APP_VERSION,
  EXPECTED_ORIGINAL_ASAR_SHA256,
  EXPECTED_ORIGINAL_HEADER_SHA256,
  assertExpectedVersion,
  inspectArchive,
  patchArchiveInPlace,
  verifyArchive,
} from "../src/native-pet-patch.js";

const execFile = promisify(execFileCallback);
const defaultApp = "/Applications/ChatGPT.app";
const defaultBackup = join(
  homedir(),
  "Library/Application Support/CodexPetPatcher/backups",
  `${EXPECTED_APP_VERSION}-original`,
  "ChatGPT.app",
);

function option(name: string, fallback?: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

async function sha256(path: string) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function plistValue(plist: string, key: string) {
  const { stdout } = await execFile("/usr/bin/plutil", ["-extract", key, "raw", plist]);
  return stdout.trim();
}

async function bundleInfo(appPath: string) {
  const plist = join(appPath, "Contents/Info.plist");
  const asar = join(appPath, "Contents/Resources/app.asar");
  const version = await plistValue(plist, "CFBundleShortVersionString");
  const recordedHeaderHash = await plistValue(
    plist,
    "ElectronAsarIntegrity.Resources/app\\.asar.hash",
  ).catch(async () => {
    const { stdout } = await execFile("/usr/libexec/PlistBuddy", [
      "-c",
      "Print :ElectronAsarIntegrity:Resources/app.asar:hash",
      plist,
    ]);
    return stdout.trim();
  });
  const rawHeader = getRawHeader(asar);
  return {
    appPath,
    asar,
    plist,
    version,
    asarHash: await sha256(asar),
    archiveState: (await inspectArchive(asar)).state,
    headerHash: createHash("sha256").update(rawHeader.headerString).digest("hex"),
    recordedHeaderHash,
  };
}

async function assertOriginal(info: Awaited<ReturnType<typeof bundleInfo>>) {
  assertExpectedVersion(info.version);
  if (info.archiveState !== "original") {
    throw new Error(`Expected original ASAR, found ${info.archiveState}`);
  }
  if (info.asarHash !== EXPECTED_ORIGINAL_ASAR_SHA256) {
    throw new Error(`Unexpected app.asar SHA256 ${info.asarHash}`);
  }
  if (
    info.headerHash !== EXPECTED_ORIGINAL_HEADER_SHA256 ||
    info.recordedHeaderHash !== EXPECTED_ORIGINAL_HEADER_SHA256
  ) {
    throw new Error(
      `Unexpected ASAR integrity header ${info.headerHash}/${info.recordedHeaderHash}`,
    );
  }
}

async function verifyCodeSignature(appPath: string) {
  await execFile("/usr/bin/codesign", ["--verify", "--deep", "--strict", "--verbose=4", appPath]);
}

async function updateRecordedHeaderHash(plist: string, headerHash: string) {
  await execFile("/usr/libexec/PlistBuddy", [
    "-c",
    `Set :ElectronAsarIntegrity:Resources/app.asar:hash ${headerHash}`,
    plist,
  ]);
}

async function createOriginalBackup(appPath: string, backupPath: string) {
  try {
    const existing = await bundleInfo(backupPath);
    await assertOriginal(existing);
    await verifyCodeSignature(backupPath);
    return { backupPath, reused: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      const backupExists = await stat(backupPath).then(
        () => true,
        (statError: NodeJS.ErrnoException) => {
          if (statError.code === "ENOENT") return false;
          throw statError;
        },
      );
      if (backupExists) throw error;
    }
  }
  await mkdir(dirname(backupPath), { recursive: true });
  const temporary = `${backupPath}.staging-${process.pid}`;
  await rm(temporary, { recursive: true, force: true });
  await execFile("/usr/bin/ditto", [appPath, temporary]);
  const copied = await bundleInfo(temporary);
  await assertOriginal(copied);
  await verifyCodeSignature(temporary);
  await rename(temporary, backupPath);
  return { backupPath, reused: false };
}

async function stageBundle(appPath: string, outputPath: string, backupPath: string) {
  if (outputPath === appPath || basename(outputPath) !== "ChatGPT-patched.app") {
    throw new Error(
      "Unsafe staging path: output must be a distinct ChatGPT-patched.app bundle",
    );
  }
  const source = await bundleInfo(appPath);
  await assertOriginal(source);
  await verifyCodeSignature(appPath);
  await createOriginalBackup(appPath, backupPath);

  await rm(outputPath, { recursive: true, force: true });
  await mkdir(dirname(outputPath), { recursive: true });
  await execFile("/usr/bin/ditto", [appPath, outputPath]);
  const stagedAsar = join(outputPath, "Contents/Resources/app.asar");
  const patch = await patchArchiveInPlace(stagedAsar);
  await updateRecordedHeaderHash(join(outputPath, "Contents/Info.plist"), patch.headerHash);

  // Only the outer seal changed. Preserve the app's original entitlements and
  // runtime flags while leaving every nested OpenAI-signed helper untouched.
  await execFile("/usr/bin/codesign", [
    "--force",
    "--sign",
    "-",
    "--preserve-metadata=entitlements,requirements,flags,runtime",
    outputPath,
  ]);
  await verifyCodeSignature(outputPath);
  const verified = await verifyBundle(outputPath);
  return { patch, verified, backupPath, outputPath };
}

async function verifyBundle(appPath: string) {
  const info = await bundleInfo(appPath);
  assertExpectedVersion(info.version);
  await verifyArchive(info.asar);
  if (info.headerHash !== info.recordedHeaderHash) {
    throw new Error(
      `Info.plist ASAR hash mismatch ${info.recordedHeaderHash} != ${info.headerHash}`,
    );
  }
  await verifyCodeSignature(appPath);
  return info;
}

async function restoreBundle(appPath: string, backupPath: string) {
  if (appPath === backupPath) {
    throw new Error("Unsafe restore: app and backup paths must be distinct");
  }
  const backup = await bundleInfo(backupPath);
  await assertOriginal(backup);
  await verifyCodeSignature(backupPath);
  const { stdout } = await execFile("/usr/bin/pgrep", ["-x", "ChatGPT"]).catch(() => ({ stdout: "" }));
  if (stdout.trim()) {
    throw new Error(
      "BLOCKED: ChatGPT is running. Quit it manually before whole-bundle restore; the patcher will never quit it.",
    );
  }
  const temporary = join(dirname(appPath), `.${basename(appPath)}.restore-${process.pid}`);
  await rm(temporary, { recursive: true, force: true });
  await execFile("/usr/bin/ditto", [backupPath, temporary]);
  const displaced = `${appPath}.displaced-${Date.now()}`;
  await rename(appPath, displaced);
  try {
    await rename(temporary, appPath);
    await verifyCodeSignature(appPath);
    await rm(displaced, { recursive: true, force: true });
  } catch (error) {
    await rename(displaced, appPath).catch(() => undefined);
    throw error;
  }
  return { appPath, backupPath };
}

async function main() {
  const command = process.argv[2];
  const appPath = resolve(option("--app", defaultApp)!);
  const backupPath = resolve(option("--backup", defaultBackup)!);
  if (command === "analyze") {
    console.log(JSON.stringify(await bundleInfo(appPath), null, 2));
    return;
  }
  if (command === "verify") {
    console.log(JSON.stringify(await verifyBundle(appPath), null, 2));
    return;
  }
  if (command === "stage") {
    const outputPath = resolve(
      option("--output", join(process.cwd(), "work/task-11/ChatGPT-patched.app"))!,
    );
    console.log(JSON.stringify(await stageBundle(appPath, outputPath, backupPath), null, 2));
    return;
  }
  if (command === "restore") {
    console.log(JSON.stringify(await restoreBundle(appPath, backupPath), null, 2));
    return;
  }
  if (command === "apply") {
    const info = await bundleInfo(appPath);
    if (info.archiveState === "patched") {
      console.log(JSON.stringify(await verifyBundle(appPath), null, 2));
      return;
    }
    await assertOriginal(info);
    await verifyCodeSignature(appPath);
    throw new Error(
      "BLOCKED: live apply would replace OpenAI's notarized Developer ID seal with an ad-hoc signature. Stage and verify are supported, but this patcher will not weaken the live app's trust/update/keychain posture.",
    );
  }
  throw new Error("Usage: native-pet-patcher <analyze|stage|apply|verify|restore> [--app PATH] [--backup PATH] [--output PATH]");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

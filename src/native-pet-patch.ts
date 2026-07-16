import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { extractFile, getRawHeader } from "@electron/asar";

export const EXPECTED_APP_VERSION = "26.707.72221";
export const EXPECTED_ORIGINAL_ASAR_SHA256 =
  "b5da51e5df6e996076e4cb19045cec46dd4c08cf61c19cdbc5cb426b8413b73c";
export const EXPECTED_ORIGINAL_HEADER_SHA256 =
  "9d7676e404b1b984f571edc89db3786bc2478608d343762b5e7d6d1616780f78";

type Replacement = { before: string; after: string; count: number };
type PatchTarget = { path: string; replacements: readonly Replacement[] };

const schemaReplacement = {
  before: "schema:z().int().min(80).max(224)",
  after: "schema:z().int().min(80).max(448)",
  count: 1,
} as const;

export const PATCH_TARGETS: readonly PatchTarget[] = [
  {
    path: ".vite/build/child-process-snapshot-worker.js",
    replacements: [schemaReplacement],
  },
  {
    path: ".vite/build/src-HagpvBpE.js",
    replacements: [
      {
        before: "schema:z().int().min(80).max(224)",
        after: "schema:z().int().min(80).max(448)",
        count: 1,
      },
    ],
  },
  {
    path: ".vite/build/worker.js",
    replacements: [
      {
        before: "schema:K().int().min(80).max(224)",
        after: "schema:K().int().min(80).max(448)",
        count: 1,
      },
    ],
  },
  {
    path:
      "webview/assets/app-initial~app-main~hotkey-window-new-thread-page~hotkey-window-home-page~composer-utility-bar-D9zyQF1n.js",
    replacements: [
      {
        before: "schema:U().int().min(80).max(224)",
        after: "schema:U().int().min(80).max(448)",
        count: 1,
      },
    ],
  },
  {
    path: "webview/assets/avatar-overlay-mascot-size-Ba8nSWiO.js",
    replacements: [
      {
        before: "Math.min(224,Math.max(80,e))",
        after: "Math.min(448,Math.max(80,e))",
        count: 1,
      },
    ],
  },
  {
    path: "webview/assets/pets-settings-DRl2-RM1.js",
    replacements: [
      { before: "(T-80)/144*100", after: "(T-80)/368*100", count: 1 },
      { before: "max:224,min:80", after: "max:448,min:80", count: 1 },
    ],
  },
  {
    path: ".vite/build/main-UDW_FlxC.js",
    replacements: [
      {
        before:
          "af={width:356,height:320},of={width:384,height:400}",
        after:
          "af={width:476,height:502},of={width:476,height:671}",
        count: 1,
      },
      { before: "h5=80,g5=224,_5=192/208", after: "h5=80,g5=448,_5=192/208", count: 1 },
    ],
  },
  {
    path: "webview/assets/codex-avatar-CBhzyYwb.css",
    replacements: [
      {
        before: "image-rendering:pixelated",
        after: "image-rendering:auto     ",
        count: 1,
      },
    ],
  },
] as const;

export type ArchiveState = "original" | "patched" | "partial" | "unexpected";

type AsarNode = {
  files?: Record<string, AsarNode>;
  size?: number;
  offset?: string;
  integrity?: {
    algorithm: "SHA256";
    hash: string;
    blockSize: number;
    blocks: string[];
  };
};

function occurrences(content: string, needle: string) {
  if (needle.length === 0) return 0;
  return content.split(needle).length - 1;
}

function sha256(content: Buffer | string) {
  return createHash("sha256").update(content).digest("hex");
}

function findNode(header: AsarNode, path: string) {
  let node = header;
  for (const component of path.split("/")) {
    node = node.files?.[component] as AsarNode;
    if (!node) throw new Error(`Unexpected ASAR: missing ${path}`);
  }
  return node;
}

function classifyReplacement(content: string, replacement: Replacement) {
  const before = occurrences(content, replacement.before);
  const after = occurrences(content, replacement.after);
  if (before === replacement.count && after === 0) return "original" as const;
  if (before === 0 && after === replacement.count) return "patched" as const;
  return "unexpected" as const;
}

export async function inspectArchive(archivePath: string) {
  const states: Array<"original" | "patched" | "unexpected"> = [];
  const details: Array<{ path: string; state: string }> = [];
  for (const target of PATCH_TARGETS) {
    let content: string;
    try {
      content = extractFile(archivePath, target.path).toString("utf8");
    } catch {
      states.push("unexpected");
      details.push({ path: target.path, state: "missing" });
      continue;
    }
    for (const replacement of target.replacements) {
      const state = classifyReplacement(content, replacement);
      states.push(state);
      details.push({ path: target.path, state });
    }
  }

  let state: ArchiveState;
  if (states.every((value) => value === "original")) state = "original";
  else if (states.every((value) => value === "patched")) state = "patched";
  else if (states.includes("unexpected")) state = "unexpected";
  else state = "partial";
  return { state, details };
}

function replaceExactly(buffer: Buffer, replacement: Replacement) {
  const before = Buffer.from(replacement.before);
  const after = Buffer.from(replacement.after);
  if (before.byteLength !== after.byteLength) {
    throw new Error(`Unsafe size-changing replacement: ${replacement.before}`);
  }
  let offset = 0;
  let count = 0;
  while ((offset = buffer.indexOf(before, offset)) !== -1) {
    after.copy(buffer, offset);
    offset += after.byteLength;
    count += 1;
  }
  if (count !== replacement.count) {
    throw new Error(
      `Unexpected replacement count for ${replacement.before}: ${count}`,
    );
  }
  return count;
}

function updateIntegrity(node: AsarNode, content: Buffer) {
  if (!node.integrity || node.integrity.algorithm !== "SHA256") {
    throw new Error("Unexpected ASAR: target has no SHA256 integrity metadata");
  }
  const blockSize = node.integrity.blockSize;
  node.integrity.hash = sha256(content);
  node.integrity.blocks = [];
  for (let offset = 0; offset < content.byteLength; offset += blockSize) {
    node.integrity.blocks.push(sha256(content.subarray(offset, offset + blockSize)));
  }
}

export async function patchArchiveInPlace(archivePath: string) {
  const inspection = await inspectArchive(archivePath);
  const rawHeader = getRawHeader(archivePath);
  if (inspection.state === "patched") {
    return {
      stateBefore: "patched" as const,
      stateAfter: "patched" as const,
      replacementCount: 0,
      headerHash: sha256(rawHeader.headerString),
    };
  }
  if (inspection.state !== "original") {
    throw new Error(
      `${inspection.state === "partial" ? "Partial" : "Unexpected"} ASAR patch state; refusing to modify`,
    );
  }

  const archive = await readFile(archivePath);
  const header = rawHeader.header as AsarNode;
  let replacementCount = 0;
  for (const target of PATCH_TARGETS) {
    const node = findNode(header, target.path);
    if (node.offset == null || node.size == null) {
      throw new Error(`Unexpected ASAR node metadata for ${target.path}`);
    }
    const start = 8 + rawHeader.headerSize + Number(node.offset);
    const content = archive.subarray(start, start + node.size);
    for (const replacement of target.replacements) {
      replacementCount += replaceExactly(content, replacement);
    }
    updateIntegrity(node, content);
  }

  const headerString = JSON.stringify(header);
  if (Buffer.byteLength(headerString) !== Buffer.byteLength(rawHeader.headerString)) {
    throw new Error("Unsafe ASAR header size change; refusing to write");
  }
  if (archive.readUInt32LE(12) !== Buffer.byteLength(rawHeader.headerString)) {
    throw new Error("Unexpected ASAR pickle layout; refusing to write");
  }
  archive.write(headerString, 16, "utf8");

  const metadata = await stat(archivePath);
  const temporary = `${archivePath}.codex-pet-staging-${process.pid}`;
  await writeFile(temporary, archive, { mode: metadata.mode });
  await rename(temporary, archivePath);

  const verification = await inspectArchive(archivePath);
  if (verification.state !== "patched") {
    throw new Error(`Patched ASAR failed verification: ${verification.state}`);
  }
  return {
    stateBefore: "original" as const,
    stateAfter: "patched" as const,
    replacementCount,
    headerHash: sha256(headerString),
  };
}

export async function verifyArchive(archivePath: string) {
  const result = await inspectArchive(archivePath);
  if (result.state !== "patched") {
    throw new Error(`ASAR is not fully patched: ${result.state}`);
  }
  for (const target of PATCH_TARGETS) extractFile(archivePath, target.path);
  return result;
}

export function assertExpectedVersion(version: string) {
  if (version !== EXPECTED_APP_VERSION) {
    throw new Error(
      `Unsupported Codex version ${version}; expected ${EXPECTED_APP_VERSION}`,
    );
  }
}

const backedUpPaths = [
  "Contents/Resources/app.asar",
  "Contents/Info.plist",
  "Contents/_CodeSignature/CodeResources",
] as const;

export async function backupBundleFiles(appPath: string, backupDirectory: string) {
  await mkdir(backupDirectory, { recursive: true });
  for (const relativePath of backedUpPaths) {
    const destination = join(backupDirectory, relativePath);
    await mkdir(dirname(destination), { recursive: true });
    await cp(join(appPath, relativePath), destination);
  }
}

export async function restoreBundleFiles(appPath: string, backupDirectory: string) {
  for (const relativePath of backedUpPaths) {
    const destination = join(appPath, relativePath);
    const temporary = `${destination}.codex-pet-restore-${process.pid}`;
    await mkdir(dirname(destination), { recursive: true });
    await cp(join(backupDirectory, relativePath), temporary);
    await rename(temporary, destination);
  }
}

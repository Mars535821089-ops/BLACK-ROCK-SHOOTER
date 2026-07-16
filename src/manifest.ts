import { writeFile } from "node:fs/promises";

export function createManifest() {
  return {
    displayName: "BLACK★ROCK SHOOTER",
    description: "A cool-headed blue-flame swordswoman who tracks your Codex tasks.",
    spriteVersionNumber: 2,
    spritesheetPath: "spritesheet.webp",
  } as const;
}

export async function writeManifest(path: string) {
  await writeFile(path, `${JSON.stringify(createManifest(), null, 2)}\n`, "utf8");
}

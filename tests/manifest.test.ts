import { expect, it } from "vitest";
import { createManifest } from "../src/manifest.js";

it("creates the native v2 manifest", () => {
  expect(createManifest()).toEqual({
    displayName: "Blueflame",
    description: "A cool-headed blue-flame swordswoman who tracks your Codex tasks.",
    spriteVersionNumber: 2,
    spritesheetPath: "spritesheet.webp",
  });
});

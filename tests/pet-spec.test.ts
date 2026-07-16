import { describe, expect, it } from "vitest";
import { PET_SPEC, STATE_NAMES, cellFor, weaponVisibleFor } from "../src/pet-spec.js";

describe("Codex Pet v2 contract", () => {
  it("uses the exact native grid", () => {
    expect(PET_SPEC).toMatchObject({
      version: 2,
      columns: 8,
      rows: 11,
      cellWidth: 192,
      cellHeight: 208,
      sheetWidth: 1536,
      sheetHeight: 2288,
    });
  });

  it("maps every native animation row", () => {
    expect(STATE_NAMES).toEqual([
      "idle", "running-right", "running-left", "waving", "jumping",
      "failed", "waiting", "running", "review",
    ]);
    expect(cellFor("review", 5)).toEqual({ left: 960, top: 1664 });
  });

  it("enforces the approved weapon rule", () => {
    expect(weaponVisibleFor("idle")).toBe(false);
    expect(weaponVisibleFor("waiting")).toBe(false);
    expect(weaponVisibleFor("review")).toBe(false);
    expect(weaponVisibleFor("jumping")).toBe(false);
    expect(weaponVisibleFor("running")).toBe(true);
    expect(weaponVisibleFor("running-left")).toBe(true);
    expect(weaponVisibleFor("running-right")).toBe(true);
    expect(weaponVisibleFor("waving")).toBe(true);
    expect(weaponVisibleFor("failed")).toBe(true);
  });
});

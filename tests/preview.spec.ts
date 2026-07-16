import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { STATE_NAMES, STATES } from "../src/pet-spec.js";

const sizes = [80, 113, 224] as const;

test("switches every native state and reproduces the native size slider", async ({
  page,
}) => {
  await page.goto("/preview/");

  const pet = page.getByTestId("pet");
  const state = page.getByLabel("State");
  const size = page.getByLabel("Pet size");

  await expect(pet).toHaveAttribute("data-state", "idle");
  await expect(state.locator("option")).toHaveCount(STATE_NAMES.length);
  await expect(size).toHaveAttribute("min", "80");
  await expect(size).toHaveAttribute("max", "224");
  await expect(size).toHaveValue("113");
  await expect(pet).toHaveCSS("image-rendering", "pixelated");
  await expect(pet).toHaveCSS("background-size", "800% 1100%");

  for (const name of STATE_NAMES) {
    await state.selectOption(name);
    await expect(pet).toHaveAttribute("data-state", name);
    await expect(pet).toHaveAttribute("data-weapon", String(STATES[name].weapon));
  }

  for (const value of sizes) {
    await size.fill(String(value));
    await expect(pet).toHaveCSS("width", `${value}px`);
    const bounds = await pet.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.height / bounds!.width).toBeCloseTo(208 / 192, 2);
    await expect(page.getByTestId("size-value")).toHaveText(`${value} px`);
  }
});

test("advances frames on the native 160 millisecond cadence", async ({ page }) => {
  await page.clock.install();
  await page.goto("/preview/");

  const pet = page.getByTestId("pet");
  await expect(pet).toHaveAttribute("data-frame", "0");
  await page.clock.fastForward(159);
  await expect(pet).toHaveAttribute("data-frame", "0");
  await page.clock.fastForward(1);
  await expect(pet).toHaveAttribute("data-frame", "1");
});

test("holds the first frame when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/preview/");

  const pet = page.getByTestId("pet");
  await expect(pet).toHaveAttribute("data-frame", "0");
  await page.waitForTimeout(1_300);
  await expect(pet).toHaveAttribute("data-frame", "0");
});

test("captures every state at the native review sizes", async ({ page }) => {
  await mkdir("work/preview-evidence", { recursive: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/preview/");

  const pet = page.getByTestId("pet");
  const state = page.getByLabel("State");
  const size = page.getByLabel("Pet size");

  for (const name of STATE_NAMES) {
    await state.selectOption(name);
    for (const value of sizes) {
      await size.fill(String(value));
      await expect(pet).toHaveCSS("width", `${value}px`);
      await pet.screenshot({
        animations: "disabled",
        path: `work/preview-evidence/${name}-${value}.png`,
      });
    }
  }

  await state.selectOption("idle");
  await size.fill("113");
  await page.screenshot({
    animations: "disabled",
    path: "work/preview-evidence/preview-workbench.png",
  });
});

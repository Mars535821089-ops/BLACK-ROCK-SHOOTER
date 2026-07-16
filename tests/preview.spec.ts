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
  await expect(pet).toHaveAttribute(
    "aria-label",
    "BLACK★ROCK SHOOTER idle animation",
  );
  await expect(state.locator("option")).toHaveCount(STATE_NAMES.length);
  await expect(size).toHaveAttribute("min", "80");
  await expect(size).toHaveAttribute("max", "224");
  await expect(size).toHaveValue("113");
  await expect(page.getByTestId("size-value")).toHaveText("113 px");
  await expect(pet).toHaveCSS("image-rendering", "pixelated");
  await expect(pet).toHaveCSS("background-size", "800% 1100%");

  for (const name of STATE_NAMES) {
    await state.selectOption(name);
    await expect(pet).toHaveAttribute("data-state", name);
    await expect(pet).toHaveAttribute(
      "aria-label",
      `BLACK★ROCK SHOOTER ${name.replaceAll("-", " ")} animation`,
    );
    await expect(pet).toHaveAttribute("data-weapon", String(STATES[name].weapon));
  }

  for (const value of sizes) {
    await size.fill(String(value));
    await expect(pet).toHaveCSS("width", `${value}px`);
    const bounds = await pet.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.height / bounds!.width).toBeCloseTo(208 / 192, 2);
    const stageBounds = await page.getByLabel("Animated pet stage").boundingBox();
    expect(stageBounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(stageBounds!.x);
    expect(bounds!.y).toBeGreaterThanOrEqual(stageBounds!.y);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
      stageBounds!.x + stageBounds!.width,
    );
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
      stageBounds!.y + stageBounds!.height,
    );
    await expect(page.getByTestId("size-value")).toHaveText(`${value} px`);
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBe(await page.evaluate(() => window.innerWidth));
});

test("maps every state row and wraps after its configured final frame", async ({
  page,
}) => {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(0);
  await page.goto("/preview/");

  const pet = page.getByTestId("pet");
  const state = page.getByLabel("State");

  for (const name of STATE_NAMES) {
    const spec = STATES[name];
    const finalX = `${Number((((spec.frames - 1) / 7) * 100).toFixed(4))}%`;
    const expectedY = `${(spec.row / 10) * 100}%`;
    await state.selectOption(name);

    await expect
      .poll(() =>
        pet.evaluate((element) => ({
          frame: element.dataset.frame,
          position: element.style.backgroundPosition,
        })),
      )
      .toEqual({ frame: "0", position: `0% ${expectedY}` });

    await page.clock.runFor((spec.frames - 1) * 160);
    await expect
      .poll(() =>
        pet.evaluate((element) => ({
          frame: element.dataset.frame,
          position: element.style.backgroundPosition,
        })),
      )
      .toEqual({
        frame: String(spec.frames - 1),
        position: `${finalX} ${expectedY}`,
      });

    await page.clock.runFor(160);
    await expect
      .poll(() =>
        pet.evaluate((element) => ({
          frame: element.dataset.frame,
          position: element.style.backgroundPosition,
        })),
      )
      .toEqual({ frame: "0", position: `0% ${expectedY}` });
  }
});

test("advances frames on the native 160 millisecond cadence", async ({ page }) => {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(0);
  await page.goto("/preview/");

  const pet = page.getByTestId("pet");
  await expect(pet).toHaveAttribute("data-frame", "0");
  await page.clock.runFor(159);
  await expect(pet).toHaveAttribute("data-frame", "0");
  await page.clock.runFor(1);
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
  await mkdir("work/task-10/after/pixel-qa", { recursive: true });
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

  await page.addStyleTag({ content: `
    html, body, .review-shell, .motion-stage, .pet-frame { background: transparent !important; }
    .motion-stage::before, .motion-stage::after, .frame-line { display: none !important; }
    #pet { filter: none !important; }
  ` });
  for (const name of STATE_NAMES) {
    await state.selectOption(name);
    for (const value of sizes) {
      await size.fill(String(value));
      await pet.screenshot({
        animations: "disabled",
        omitBackground: true,
        path: `work/task-10/after/pixel-qa/${name}-${value}.png`,
      });
    }
  }
});

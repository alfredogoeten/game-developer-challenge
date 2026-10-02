import { expect, test } from "@playwright/test";
import "../src/features/battle/testBridge";

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.project.name === "mobile-chromium")
    await page.setViewportSize({ width: 851, height: 393 });
  await page.goto("/?e2e=1");
});

test("menu visual baseline", async ({ page }) => {
  await expect(
    page.getByRole("heading", { name: "Pirate Battle" }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("menu.png", {
    animations: "disabled",
    fullPage: true,
  });
});

test("options controls visual baseline", async ({ page }) => {
  await page.getByRole("button", { name: "Options" }).click();
  await expect(page.getByRole("button", { name: "Increase Game session time" })).toBeVisible();
  await expect(page).toHaveScreenshot("options.png", { animations: "disabled", fullPage: true });
});

test("stable arena visual baseline", async ({ page }) => {
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator(".battle-stage canvas")).toBeVisible();
  await expect(page).toHaveScreenshot("arena.png", {
    animations: "disabled",
    fullPage: true,
  });
});

test("projectile impact visual baseline", async ({ page }) => {
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(() => Boolean(window.__pirateBattleTest));
  await page.evaluate(() => {
    window.__pirateBattleTest!.spawn("shooter", 280, 270);
  });
  await page.keyboard.down("Space");
  await page.evaluate(() => window.__pirateBattleTest!.step(9));
  await page.keyboard.up("Space");
  await expect(page).toHaveScreenshot("impact.png", {
    animations: "disabled",
    fullPage: true,
  });
});

test("partially depleted red ship health visual baseline", async ({ page }) => {
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(() => Boolean(window.__pirateBattleTest));
  await page.keyboard.down("d");
  await page.evaluate(() => window.__pirateBattleTest!.step(30));
  await page.keyboard.up("d");
  await page.evaluate(() => window.__pirateBattleTest!.spawn("chaser", 188, 370));
  await page.keyboard.down("Space");
  await page.evaluate(() => window.__pirateBattleTest!.step(9));
  await page.keyboard.up("Space");
  expect((await page.evaluate(() => window.__pirateBattleTest!.snapshot())).enemies[0].health).toBe(1);
  await expect(page).toHaveScreenshot("ship-health.png", { animations: "disabled", fullPage: true });
});

test("result visual baseline", async ({ page }) => {
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(() => Boolean(window.__pirateBattleTest));
  await page.evaluate(() => {
    const bridge = window.__pirateBattleTest!;
    bridge.setElapsed(119.99);
    bridge.step(1);
  });
  await expect(
    page.getByRole("heading", { name: "Battle Complete" }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("result.png", {
    animations: "disabled",
    fullPage: true,
  });
});

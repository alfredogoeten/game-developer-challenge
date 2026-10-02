import { expect, test, type Page } from "@playwright/test";
import "../src/features/battle/testBridge";

const viewports = [
  { width: 320, height: 568 },
  { width: 667, height: 375 },
  { width: 851, height: 393 },
  { width: 956, height: 440 },
] as const;

async function expectFits(page: Page) {
  const size = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
    viewportWidth: document.documentElement.clientWidth,
    viewportHeight: document.documentElement.clientHeight,
    buttons: [...document.querySelectorAll<HTMLButtonElement>("main button")]
      .filter((button) => button.getClientRects().length && getComputedStyle(button).visibility !== "hidden")
      .map((button) => ({ name: button.getAttribute("aria-label") || button.textContent?.trim(), rect: button.getBoundingClientRect().toJSON() })),
  }));
  expect(size.width).toBeLessThanOrEqual(size.viewportWidth);
  expect(size.height).toBeLessThanOrEqual(size.viewportHeight);
  for (const button of size.buttons) {
    expect(button.rect.top, `${button.name} top`).toBeGreaterThanOrEqual(-1);
    expect(button.rect.bottom, `${button.name} bottom`).toBeLessThanOrEqual(size.viewportHeight + 1);
  }
}

for (const viewport of viewports) {
  test(`all mobile screens and dialogs fit ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/?e2e=1");
    await expectFits(page);
    await page.getByRole("button", { name: "Options" }).click();
    await expectFits(page);
    await page.getByRole("button", { name: "MAIN MENU" }).click();
    await page.getByRole("button", { name: "Ranking" }).click();
    await expect(page.getByText(/Page 1 of/)).toBeVisible();
    await expectFits(page);
    await page.getByRole("button", { name: "Back to main menu" }).click();
    await page.getByRole("button", { name: "Match History" }).click();
    await expectFits(page);
    await page.getByRole("button", { name: "Back to main menu" }).click();
    if (viewport.width === 320) await page.setViewportSize({ width: 851, height: 393 });
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.waitForFunction(() => Boolean(window.__pirateBattleTest));
    await page.keyboard.press("Escape");
    await page.getByRole("dialog", { name: "Game paused" }).getByRole("button", { name: "Main Menu" }).click();
    await page.setViewportSize(viewport);
    await expect(page.getByRole("dialog", { name: "Leave game" })).toBeVisible();
    await expectFits(page);
    await page.getByRole("button", { name: "Keep Playing" }).click();
    if (viewport.width === 320) await page.setViewportSize({ width: 851, height: 393 });
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await page.evaluate(() => {
      window.__pirateBattleTest!.setElapsed(59.99);
      window.__pirateBattleTest!.step(1);
    });
    await page.setViewportSize(viewport);
    await expect(page.getByRole("heading", { name: "Battle Complete" })).toBeVisible();
    await expectFits(page);
  });
}

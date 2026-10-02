import { expect, test, type Page } from "@playwright/test";

const storageKey = "pirate-battle.options.v1";
const optionValue = (page: Page, field: string) => page.getByTestId(`${field}-value`);

test("menu controls remain usable and fit the viewport", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Pirate Battle");
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Options" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ranking" })).toBeVisible();
  if (testInfo.project.name === "chromium") await expect(page.getByText("W or ↑")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("each adjustment saves immediately and MAIN MENU returns focus", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Options" }).click();
  await expect(page.getByRole("heading", { name: "Options" })).toBeFocused();
  await expect(optionValue(page, "sessionDurationSeconds")).toHaveText("60 s");
  await page.getByRole("button", { name: "Increase Game session time" }).click();
  await page.getByRole("button", { name: "Increase Enemy spawn time" }).click();
  await expect(optionValue(page, "sessionDurationSeconds")).toHaveText("180 s");
  await expect(optionValue(page, "enemySpawnIntervalSeconds")).toHaveText("4 s");
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey)).toEqual({ sessionDurationSeconds: 180, enemySpawnIntervalSeconds: 4 });
  await page.getByRole("button", { name: "MAIN MENU" }).click();
  await expect(page.getByRole("button", { name: "Options" })).toBeFocused();
  await page.reload();
  await page.getByRole("button", { name: "Options" }).click();
  await expect(optionValue(page, "sessionDurationSeconds")).toHaveText("180 s");
  await expect(optionValue(page, "enemySpawnIntervalSeconds")).toHaveText("4 s");
  await page.getByRole("button", { name: "Decrease Enemy spawn time" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Options" })).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).enemySpawnIntervalSeconds, storageKey)).toBe(3);
});

test("failed storage keeps the old value and another click retries", async ({ page }) => {
  await page.addInitScript((key) => {
    const original = Storage.prototype.setItem;
    let fail = true;
    Object.defineProperty(window, "__allowOptionsSave", { value: () => { fail = false; } });
    Storage.prototype.setItem = function (name, value) {
      if (name === key && fail) throw new Error("Storage unavailable");
      return original.call(this, name, value);
    };
  }, storageKey);
  await page.goto("/");
  await page.getByRole("button", { name: "Options" }).click();
  await page.getByRole("button", { name: "Increase Game session time" }).click();
  await expect(page.getByRole("alert")).toContainText("could not be saved");
  await expect(optionValue(page, "sessionDurationSeconds")).toHaveText("60 s");
  await page.evaluate(() => window.__allowOptionsSave!());
  await page.getByRole("button", { name: "Increase Game session time" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(optionValue(page, "sessionDurationSeconds")).toHaveText("180 s");
});

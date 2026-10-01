import { expect, test, type Page } from "@playwright/test";

const storageKey = "pirate-battle.options.v1";

test("shows the accessible menu and available game", async ({ page }) => {
  const pageErrors = watchPageErrors(page);

  await page.goto("/");

  await expect(page).toHaveTitle("Pirate Battle");
  await expect(
    page.getByRole("heading", { name: "Pirate Battle" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Play" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Ranking" })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Match History" }),
  ).toBeDisabled();
  await expect(page.getByText("W or ↑")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);

  expect(pageErrors).toEqual([]);
});

test("navigates preset values, saves them, and restores menu focus", async ({
  page,
}) => {
  const pageErrors = watchPageErrors(page);

  await page.goto("/");
  await page.getByRole("button", { name: "Options" }).click();

  await expect(page.getByRole("heading", { name: "Options" })).toBeFocused();
  await expect(page.locator('input[type="number"]')).toHaveCount(0);
  await expect(optionValue(page, "sessionDurationSeconds")).toHaveText("120 s");

  await page
    .getByRole("button", { name: "Increase Game session time" })
    .click();
  await expect(optionValue(page, "sessionDurationSeconds")).toHaveText("180 s");
  await expect(
    page.getByRole("button", { name: "Increase Game session time" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Increase Enemy spawn time" }).click();
  await page.getByRole("button", { name: "Increase Enemy spawn time" }).click();
  await expect(optionValue(page, "enemySpawnIntervalSeconds")).toHaveText(
    "5 s",
  );
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("status")).toHaveText("Options saved.");
  await expect(page.getByRole("button", { name: "Options" })).toBeFocused();

  await page.reload();
  await page.getByRole("button", { name: "Options" }).click();
  await expect(optionValue(page, "sessionDurationSeconds")).toHaveText("180 s");
  await expect(optionValue(page, "enemySpawnIntervalSeconds")).toHaveText(
    "5 s",
  );

  expect(pageErrors).toEqual([]);
});

test("confirms before discarding unsaved selections", async ({ page }) => {
  const pageErrors = watchPageErrors(page);

  await page.goto("/");
  await page.getByRole("button", { name: "Options" }).click();

  await page.getByRole("button", { name: "Back to main menu" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Options" })).toBeFocused();
  await page.getByRole("button", { name: "Options" }).click();

  const sessionTime = optionValue(page, "sessionDurationSeconds");
  await page
    .getByRole("button", { name: "Decrease Game session time" })
    .click();
  await expect(sessionTime).toHaveText("60 s");
  await expect(
    page.getByRole("button", { name: "Decrease Game session time" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Back to main menu" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Discard changes?" }),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Discard changes" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(sessionTime).toHaveText("60 s");

  await page.getByRole("button", { name: "Back to main menu" }).click();
  await dialog.getByRole("button", { name: "Discard changes" }).click();

  await expect(page.getByRole("button", { name: "Options" })).toBeFocused();
  await page.getByRole("button", { name: "Options" }).click();
  await expect(sessionTime).toHaveText("120 s");

  expect(pageErrors).toEqual([]);
});

test("returns home with Escape and confirms unsaved changes", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Options" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Options" })).toBeFocused();

  await page.getByRole("button", { name: "Options" }).click();
  await page
    .getByRole("button", { name: "Decrease Game session time" })
    .click();
  await page.keyboard.press("Escape");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Back to main menu" }),
  ).toBeFocused();
  await expect(optionValue(page, "sessionDurationSeconds")).toHaveText("60 s");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Discard changes" }).click();
  await expect(page.getByRole("button", { name: "Options" })).toBeFocused();
});

test("falls back safely for corrupt storage and reports failed saves", async ({
  page,
}) => {
  await page.addInitScript(
    (key) => window.localStorage.setItem(key, "{invalid json"),
    storageKey,
  );
  const pageErrors = watchPageErrors(page);

  await page.goto("/");
  await page.getByRole("button", { name: "Options" }).click();
  await expect(optionValue(page, "sessionDurationSeconds")).toHaveText("120 s");
  await expect(optionValue(page, "enemySpawnIntervalSeconds")).toHaveText(
    "3 s",
  );

  await page.addInitScript((key) => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(storageKey, value) {
      if (storageKey === key) {
        throw new Error("Storage is unavailable");
      }

      return originalSetItem.call(this, storageKey, value);
    };
  }, storageKey);
  await page.reload();
  await page.getByRole("button", { name: "Options" }).click();
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("alert")).toHaveText(
    "Your options could not be saved. Please try again.",
  );
  await expect(page.getByRole("heading", { name: "Options" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

function optionValue(page: Page, field: string) {
  return page.getByTestId(`${field}-value`);
}

function watchPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  return errors;
}

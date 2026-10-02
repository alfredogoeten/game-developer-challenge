import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.project.name === "mobile-chromium")
    await page.setViewportSize({ width: 851, height: 393 });
  await page.goto("/?e2e=1");
});

async function openRecords(page: Page, title: "Ranking" | "Match History") {
  await page.getByRole("button", { name: title }).click();
  await expect(page.getByRole("heading", { name: title })).toBeFocused();
  return page.getByRole("region", { name: title });
}

async function returnToMenu(page: Page) {
  await page.getByRole("button", { name: "Back to main menu" }).click();
}

async function setNetworkScenario(page: Page, scenario: string) {
  await page.evaluate((value) => {
    localStorage.setItem("pirate-battle.network.v1", value);
  }, scenario);
  await page.reload();
}

async function completeMatch(page: Page) {
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(() => Boolean(window.__pirateBattleTest));
  await page.evaluate(() => {
    window.__pirateBattleTest!.setElapsed(119.99);
    window.__pirateBattleTest!.step(1);
  });
  await expect(page.getByRole("heading", { name: "Battle Complete" })).toBeVisible();
}

test("opens Ranking as a screen and paginates it", async ({ page }, testInfo) => {
  const pageSize = testInfo.project.name === "mobile-chromium" ? 2 : 5;
  const totalPages = Math.ceil(12 / pageSize);
  const ranking = await openRecords(page, "Ranking");
  await expect(ranking.getByText(`Page 1 of ${totalPages}`)).toBeVisible();
  await expect(ranking.locator("li")).toHaveCount(pageSize);
  await ranking.getByRole("button", { name: "Next" }).click();
  await expect(ranking.getByText(`Page 2 of ${totalPages}`)).toBeVisible();
});

test("switching record sections resets pagination to page one", async ({ page }, testInfo) => {
  await setNetworkScenario(page, "multiple-pages");
  const totalPages = testInfo.project.name === "mobile-chromium" ? 6 : 3;
  const ranking = await openRecords(page, "Ranking");
  await expect(ranking.getByText(`Page 1 of ${totalPages}`)).toBeVisible();

  for (let current = 1; current < totalPages; current++) {
    await ranking.getByRole("button", { name: "Next page" }).click();
    await expect(ranking.getByText(`Page ${current + 1} of ${totalPages}`)).toBeVisible();
  }

  await ranking.getByRole("button", { name: "Match History" }).click();
  const history = page.getByRole("region", { name: "Match History" });
  await expect(history.getByText(`Page 1 of ${totalPages}`)).toBeVisible();

  for (let current = 1; current < totalPages; current++) {
    await history.getByRole("button", { name: "Next page" }).click();
    await expect(history.getByText(`Page ${current + 1} of ${totalPages}`)).toBeVisible();
  }

  await history.getByRole("button", { name: "Ranking" }).click();
  await expect(page.getByRole("region", { name: "Ranking" }).getByText(`Page 1 of ${totalPages}`)).toBeVisible();
});

test("filters Ranking by saved options", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: "Options" }).click();
  await page.getByRole("button", { name: "Increase Enemy spawn time" }).click();
  await page.getByRole("button", { name: "Increase Enemy spawn time" }).click();
  await page.getByRole("button", { name: "MAIN MENU" }).click();
  const ranking = await openRecords(page, "Ranking");
  await expect(ranking.getByText(testInfo.project.name === "mobile-chromium" ? "Page 1 of 2" : "Page 1 of 1")).toBeVisible();
  await expect(ranking.locator("li")).toHaveCount(testInfo.project.name === "mobile-chromium" ? 2 : 3);
});

test("shows a completed match in Match History", async ({ page }) => {
  await completeMatch(page);
  await expect(page.getByText("Recorded", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Main Menu" }).click();
  const history = await openRecords(page, "Match History");
  await expect(history.locator("li")).toHaveCount(1);
});

test("Match History uses the responsive page size", async ({ page }, testInfo) => {
  await setNetworkScenario(page, "multiple-pages");
  const history = await openRecords(page, "Match History");
  const mobile = testInfo.project.name === "mobile-chromium";
  await expect(history.locator("li")).toHaveCount(mobile ? 2 : 5);
  await expect(history.getByText(`Page 1 of ${mobile ? 6 : 3}`)).toBeVisible();
});

test("shows empty and isolated errors on their own screens", async ({ page }) => {
  await setNetworkScenario(page, "empty");
  const ranking = await openRecords(page, "Ranking");
  await expect(ranking.getByText("No ranking entries to show.")).toBeVisible();
  await returnToMenu(page);
  await setNetworkScenario(page, "history-error");
  const history = await openRecords(page, "Match History");
  await expect(history.getByRole("alert")).toContainText(
    "Could not load match history.",
  );
});

test("returns from Match History with Escape and restores focus", async ({ page }) => {
  await openRecords(page, "Match History");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Match History" })).toBeFocused();
});

test("selects a network scenario from the menu and resets confirmed mock data", async ({
  page,
}) => {
  await page.selectOption("#network-scenario", "ranking-error");
  const ranking = await openRecords(page, "Ranking");
  await expect(ranking.getByRole("alert")).toContainText("Could not load ranking.");
  await returnToMenu(page);

  await page.selectOption("#network-scenario", "success");
  await completeMatch(page);
  await expect(page.getByText("Recorded", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Main Menu" }).click();
  await page.getByRole("button", { name: "Reset mock data" }).click();

  const history = await openRecords(page, "Match History");
  await expect(history.getByText("No completed matches to show.")).toBeVisible();
  await returnToMenu(page);
  await expect(page.locator("#network-scenario")).toHaveValue("success");
  await expect(page.getByRole("button", { name: "Last Result" })).toBeVisible();
});

test("recovers a post-commit timeout through the menu scenario controls", async ({
  page,
}) => {
  await page.selectOption("#network-scenario", "post-commit-timeout");
  await completeMatch(page);
  await expect(page.getByText("Pending", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Main Menu" }).click();

  await page.selectOption("#network-scenario", "success");
  await page.getByRole("button", { name: "Retry Sync" }).click();
  await page.getByRole("button", { name: "Last Result" }).click();
  await expect(page.getByText("Recorded", { exact: true })).toBeVisible();
});

test("keeps the newest page when out-of-order responses finish", async ({
  page,
}, testInfo) => {
  const totalPages = testInfo.project.name === "mobile-chromium" ? 6 : 3;
  await page.selectOption("#network-scenario", "out-of-order");
  const ranking = await openRecords(page, "Ranking");
  await expect(ranking.getByText(`Page 1 of ${totalPages}`)).toBeVisible();
  await ranking.getByRole("button", { name: "Next page" }).click();
  await ranking.getByRole("button", { name: "Next page" }).click();
  await expect(ranking.getByText(`Page 3 of ${totalPages}`)).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(ranking.getByText(`Page 3 of ${totalPages}`)).toBeVisible();
});

test("changes page size with the viewport and resets to page one", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium");
  const ranking = await openRecords(page, "Ranking");
  await expect(ranking.locator("li")).toHaveCount(5);
  await ranking.getByRole("button", { name: "Next page" }).click();
  await expect(ranking.getByText("Page 2 of 3")).toBeVisible();
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(ranking.getByText("Page 1 of 6")).toBeVisible();
  await expect(ranking.locator("li")).toHaveCount(2);
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(ranking.getByText("Page 1 of 3")).toBeVisible();
  await expect(ranking.locator("li")).toHaveCount(5);
});

test("mock rejects unsupported page sizes and stays active after refresh", async ({ page }, testInfo) => {
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  const status = await page.evaluate(async () => (await fetch("/api/ranking?config=test&page=1&pageSize=3")).status);
  expect(status).toBe(400);
  await page.reload();
  const ranking = await openRecords(page, "Ranking");
  await expect(ranking.locator("li")).toHaveCount(testInfo.project.name === "mobile-chromium" ? 2 : 5);
});

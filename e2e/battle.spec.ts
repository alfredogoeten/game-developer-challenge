import { expect, test, type Page } from "@playwright/test";
import {
  BATTLE_BALANCE,
  createGameBalance,
} from "../src/features/battle/gameBalance";
import type { BattleTestBridge } from "../src/features/battle/testBridge";

type Snapshot = ReturnType<BattleTestBridge["snapshot"]>;

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.project.name === "mobile-chromium")
    await page.setViewportSize({ width: 851, height: 393 });
  await page.goto("/?e2e=1");
});

async function start(page: Page) {
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator(".battle-stage canvas")).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__pirateBattleTest));
}

async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => window.__pirateBattleTest!.snapshot());
}

async function step(page: Page, ticks: number) {
  await page.evaluate((count) => window.__pirateBattleTest!.step(count), ticks);
}

async function spawn(
  page: Page,
  kind: "chaser" | "shooter",
  x: number,
  y: number,
) {
  await page.evaluate(
    ([enemyKind, enemyX, enemyY]) =>
      window.__pirateBattleTest!.spawn(enemyKind, enemyX, enemyY),
    [kind, x, y] as const,
  );
}

test("loads assets and retries after a failed texture", async ({ page }) => {
  await page.evaluate(() => { window.__pirateBattleFailAssetAttempts = 2; });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Battle assets could not be loaded",
  );
  await page.getByRole("button", { name: "Try Again" }).click();
  await expect(page.locator(".battle-stage canvas")).toBeVisible();
});

test("moves, rotates and stops at arena and island boundaries", async ({
  page,
}) => {
  await start(page);
  const initial = await snapshot(page);
  await page.keyboard.down("w");
  const islands = createGameBalance({
    sessionDurationSeconds: 60,
    enemySpawnIntervalSeconds: 3,
  }).islands;
  const westernEdge = Math.max(
    ...islands[0].lobes.map((lobe) => islands[0].x + lobe.x + lobe.radius),
  );
  const easternEdge = Math.min(
    ...islands[1].lobes.map((lobe) => islands[1].x + lobe.x - lobe.radius),
  );
  expect(easternEdge - westernEdge).toBeGreaterThan(120);
  for (let index = 0; index < 15; index += 1) {
    await step(page, 10);
    const player = (await snapshot(page)).player;
    for (const island of islands) {
      for (const lobe of island.lobes) {
        expect(
          Math.hypot(
            player.x - island.x - lobe.x,
            player.y - island.y - lobe.y,
          ),
        ).toBeGreaterThanOrEqual(lobe.radius + 22 - 0.1);
      }
    }
  }
  await page.keyboard.up("w");
  const stopped = await snapshot(page);
  expect(stopped.player.x).toBeGreaterThan(initial.player.x);
  expect(stopped.player.y).toBeGreaterThan(initial.player.y);
  await page.keyboard.down("a");
  await step(page, 30);
  await page.keyboard.up("a");
  expect((await snapshot(page)).player.angle).not.toBe(initial.player.angle);
  await page.getByRole("button", { name: "Main Menu" }).click();
  await page.getByRole("button", { name: "Leave Game" }).click();
  await start(page);
  await page.keyboard.down("a");
  await step(page, 60);
  await page.keyboard.up("a");
  await page.keyboard.down("w");
  await step(page, 100);
  await page.keyboard.up("w");
  const finalState = await snapshot(page);
  expect(finalState.player.x).toBeCloseTo(22);
  expect(finalState.player.y).toBeGreaterThanOrEqual(22);
  expect(finalState.player.x).toBeLessThanOrEqual(938);
  expect(finalState.player.y).toBeLessThanOrEqual(518);
});

test("fires front and broadsides with cooldowns, damages enemies and scores once", async ({
  page,
}) => {
  await start(page);
  await spawn(page, "shooter", 280, 270);
  await page.keyboard.down("Space");
  await step(page, 1);
  const first = await snapshot(page);
  expect(
    first.projectiles.filter((item) => item.owner === "player"),
  ).toHaveLength(1);
  await step(page, 3);
  expect(
    (await snapshot(page)).projectiles.filter(
      (item) => item.owner === "player",
    ),
  ).toHaveLength(1);
  await step(page, 56);
  await page.keyboard.up("Space");
  expect((await snapshot(page)).score).toBe(1);
  const projectileCount = (await snapshot(page)).projectiles.filter(
    (item) => item.owner === "player",
  ).length;
  await page.keyboard.down("q");
  await page.keyboard.down("e");
  await step(page, 1);
  await page.keyboard.up("q");
  await page.keyboard.up("e");
  expect(
    (await snapshot(page)).projectiles.filter(
      (item) => item.owner === "player",
    ),
  ).toHaveLength(projectileCount + 6);
  expect((await snapshot(page)).score).toBe(1);
});

test("small impact explosion and ship shake follow a projectile hit", async ({
  page,
}) => {
  await start(page);
  await spawn(page, "chaser", 280, 270);
  await page.keyboard.down("Space");
  await step(page, 9);
  await page.keyboard.up("Space");
  const afterHit = await snapshot(page);
  expect(afterHit.enemies[0].health).toBe(1);
  expect(afterHit.enemies[0].hitFeedback).toBeGreaterThan(0);
  expect(afterHit.effects.some((effect) => effect.kind === "impact")).toBe(
    true,
  );
  await step(page, 20);
  const settled = await snapshot(page);
  expect(settled.enemies[0].hitFeedback).toBe(0);
  expect(settled.effects.some((effect) => effect.kind === "impact")).toBe(
    false,
  );
});

test("Shooter is destroyed by one front shot", async ({ page }) => {
  await start(page);
  await spawn(page, "shooter", 280, 270);
  expect((await snapshot(page)).enemies[0].health).toBe(1);
  await page.keyboard.down("Space");
  await step(page, 9);
  await page.keyboard.up("Space");
  const state = await snapshot(page);
  expect(state.enemies).toHaveLength(0);
  expect(state.score).toBe(1);
});

test("Chaser starts with two health and a broadside destroys it", async ({
  page,
}) => {
  await start(page);
  await spawn(page, "chaser", 188, 170);
  expect((await snapshot(page)).enemies[0].health).toBe(2);
  await page.keyboard.down("q");
  await step(page, 1);
  await page.keyboard.up("q");
  await step(page, 15);
  const state = await snapshot(page);
  expect(state.enemies).toHaveLength(0);
  expect(state.score).toBe(1);
});

test("the western island blocks a direct shot and provides cover", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Options" }).click();
  for (let index = 0; index < 7; index += 1) {
    await page
      .getByRole("button", { name: "Increase Enemy spawn time" })
      .click();
  }
  await page.getByRole("button", { name: "Save" }).click();
  await start(page);
  await spawn(page, "shooter", 495, 270);
  await step(page, 90);
  const covered = await snapshot(page);
  expect(covered.player.health).toBe(5);
  expect(
    covered.projectiles.filter((projectile) => projectile.owner === "enemy"),
  ).toHaveLength(0);
  await page.keyboard.down("Space");
  await step(page, 1);
  await page.keyboard.up("Space");
  await step(page, 20);
  const blocked = await snapshot(page);
  expect(
    blocked.projectiles.filter((projectile) => projectile.owner === "player"),
  ).toHaveLength(0);
  expect(blocked.effects.some((effect) => effect.kind === "impact")).toBe(true);
  await step(page, 300);
  const flanked = await snapshot(page);
  expect(
    flanked.player.health < 5 ||
      flanked.projectiles.some((projectile) => projectile.owner === "enemy"),
  ).toBe(true);
});

test("the second island also blocks projectiles", async ({ page }) => {
  await start(page);
  await page.keyboard.down("d");
  await step(page, 4);
  await page.keyboard.up("d");
  await page.keyboard.down("Space");
  await step(page, 1);
  await page.keyboard.up("Space");
  await step(page, 80);
  const blocked = await snapshot(page);
  expect(
    blocked.projectiles.filter((projectile) => projectile.owner === "player"),
  ).toHaveLength(0);
  expect(blocked.effects.some((effect) => effect.kind === "impact")).toBe(true);
});

test("a Chaser can navigate around the cover island", async ({ page }) => {
  await page.getByRole("button", { name: "Options" }).click();
  for (let index = 0; index < 7; index += 1) {
    await page
      .getByRole("button", { name: "Increase Enemy spawn time" })
      .click();
  }
  await page.getByRole("button", { name: "Save" }).click();
  await start(page);
  await spawn(page, "chaser", 520, 230);
  await step(page, 540);
  expect((await snapshot(page)).player.health).toBe(4);
});

for (const scenario of [
  { kind: "chaser" as const, x: 938, y: 518 },
  { kind: "shooter" as const, x: 938, y: 518 },
  { kind: "chaser" as const, x: 22, y: 518 },
]) {
  test(`${scenario.kind} escapes the ${scenario.x === 938 ? "eastern" : "western"} arena edge`, async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Options" }).click();
    for (let index = 0; index < 7; index += 1) {
      await page
        .getByRole("button", { name: "Increase Enemy spawn time" })
        .click();
    }
    await page.getByRole("button", { name: "Save" }).click();
    await start(page);
    await spawn(page, scenario.kind, scenario.x, scenario.y);
    await step(page, 480);
    const state = await snapshot(page);
    const enemy = state.enemies.find((item) => item.kind === scenario.kind);
    if (scenario.kind === "chaser" && !enemy) {
      expect(state.player.health).toBeLessThan(5);
    } else {
      expect(enemy).toBeDefined();
      expect(
        Math.hypot(enemy!.x - state.player.x, enemy!.y - state.player.y),
      ).toBeLessThan(
        Math.hypot(scenario.x - state.player.x, scenario.y - state.player.y) -
          150,
      );
      expect(enemy!.y).toBeLessThan(490);
    }
  });
}

test("spawns both enemy types, pauses without time advancement and resumes cleanly", async ({
  page,
}) => {
  await start(page);
  await step(page, 361);
  const spawned = await snapshot(page);
  expect(spawned.spawnCount).toBeGreaterThanOrEqual(2);
  expect(spawned.enemies.map((enemy) => enemy.kind)).toEqual(
    expect.arrayContaining(["chaser", "shooter"]),
  );
  await page.keyboard.down("w");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Game paused" })).toBeVisible();
  const paused = await snapshot(page);
  await step(page, 300);
  expect((await snapshot(page)).elapsed).toBe(paused.elapsed);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await step(page, 60);
  expect((await snapshot(page)).elapsed).toBeGreaterThan(paused.elapsed);
  expect((await snapshot(page)).player.x).toBe(paused.player.x);
  await page.keyboard.up("w");
});

test("Shooter fires in range and Chaser impact causes death without points", async ({
  page,
}) => {
  await start(page);
  await spawn(page, "shooter", 300, 270);
  await step(page, 91);
  const enemyProjectile = (await snapshot(page)).projectiles.find(
    (projectile) => projectile.owner === "enemy",
  );
  expect(enemyProjectile).toBeDefined();
  expect(Math.hypot(enemyProjectile!.vx, enemyProjectile!.vy)).toBeCloseTo(
    BATTLE_BALANCE.projectile.speed *
      BATTLE_BALANCE.shooter.projectileSpeedMultiplier,
  );
  await step(page, 19);
  expect((await snapshot(page)).player.health).toBe(4);
  for (let remaining = 3; remaining >= 0; remaining -= 1) {
    await spawn(page, "chaser", 210, 270);
    await step(page, 1);
    if (remaining > 0) {
      const state = await snapshot(page);
      expect(state.player.health).toBe(remaining);
      expect(state.score).toBe(0);
    }
  }
  await expect(
    page.getByRole("heading", { name: "Battle Result" }),
  ).toBeVisible();
  await expect(page.getByText("Ship destroyed")).toBeVisible();
  await expect(page.getByText("0 points")).toBeVisible();
});

test("finishes by time, records one match and starts a clean new game", async ({
  page,
}) => {
  await start(page);
  await page.evaluate(() => window.__pirateBattleTest!.setElapsed(119.99));
  await step(page, 1);
  await expect(
    page.getByRole("heading", { name: "Battle Result" }),
  ).toBeVisible();
  await expect(page.getByText("Time expired")).toBeVisible();
  await expect(page.getByText("Recorded", { exact: true })).toBeVisible();
  const first = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("pirate-battle.matches.v1") || "{}"),
  );
  expect(first.pending).toHaveLength(0);
  await page.getByRole("button", { name: "Play Again" }).click();
  await expect(page.locator(".battle-stage canvas")).toBeVisible();
  const restarted = await snapshot(page);
  expect(restarted.score).toBe(0);
  expect(restarted.player.health).toBe(5);
  expect(restarted.elapsed).toBe(0);
  await page.getByRole("button", { name: "Main Menu" }).click();
  await page.getByRole("button", { name: "Leave Game" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Last Result" }).click();
  await expect(page.getByText("Recorded", { exact: true })).toBeVisible();
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("pirate-battle.matches.v1") || "{}"),
  );
  expect(after.pending).toHaveLength(0);
});

test("abandons without recording and pauses when the tab becomes hidden", async ({
  page,
}) => {
  await start(page);
  await step(page, 30);
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  expect((await snapshot(page)).paused).toBe(true);
  await page
    .getByRole("dialog", { name: "Game paused" })
    .getByRole("button", { name: "Main Menu" })
    .click();
  await page.getByRole("button", { name: "Leave Game" }).click();
  expect(
    await page.evaluate(() => localStorage.getItem("pirate-battle.matches.v1")),
  ).toBeNull();
});

test("keeps distinct completed matches pending across refresh", async ({
  page,
}) => {
  await page.evaluate(() => {
    localStorage.setItem("pirate-battle.network.v1", "unavailable-on-post");
  });
  await page.reload();
  await start(page);
  await page.evaluate(() => window.__pirateBattleTest!.setElapsed(119.99));
  await step(page, 1);
  await page.getByRole("button", { name: "Play Again" }).click();
  await page.waitForFunction(() => Boolean(window.__pirateBattleTest));
  await page.evaluate(() => window.__pirateBattleTest!.setElapsed(119.99));
  await step(page, 1);
  const matches = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("pirate-battle.matches.v1") || "{}"),
  );
  expect(matches.pending).toHaveLength(2);
  expect(
    new Set(matches.pending.map((item: { matchId: string }) => item.matchId))
      .size,
  ).toBe(2);
  await page.reload();
  await page.getByRole("button", { name: "Last Result" }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("pirate-battle.matches.v1") || "{}")
          .pending.length,
    ),
  ).toBe(2);
});

test("retries a failed local result save without duplicating the match", async ({
  page,
}) => {
  await start(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    let reject = true;
    Object.defineProperty(window, "__allowMatchSave", {
      value: () => {
        reject = false;
      },
    });
    Storage.prototype.setItem = function (key, value) {
      if (key === "pirate-battle.matches.v1" && reject)
        throw new Error("Storage unavailable");
      return original.call(this, key, value);
    };
  });
  await page.evaluate(() => window.__pirateBattleTest!.setElapsed(119.99));
  await step(page, 1);
  await expect(page.getByText("Storage error")).toBeVisible();
  await page.evaluate(() => window.__allowMatchSave!());
  await page.getByRole("button", { name: "Retry Save" }).click();
  await expect(page.getByText("Recorded", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("pirate-battle.matches.v1") || "{}")
          .pending.length,
    ),
  ).toBe(0);
});

test("reloading an active match discards it without a pending record", async ({
  page,
}) => {
  await start(page);
  await step(page, 120);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("pirate-battle.matches.v1")),
  ).toBeNull();
});

test("portrait orientation pauses until the player resumes in landscape", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium");
  await start(page);
  await page.setViewportSize({ width: 393, height: 851 });
  await expect(
    page.getByText("Rotate your device to landscape to play."),
  ).toBeVisible();
  expect((await snapshot(page)).paused).toBe(true);
  await page.setViewportSize({ width: 851, height: 393 });
  await expect(page.getByRole("dialog", { name: "Game paused" })).toBeVisible();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  expect((await snapshot(page)).paused).toBe(false);
});

test("touch controls can move and fire together in mobile landscape", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium");
  await start(page);
  const initial = await snapshot(page);
  const forward = page.getByRole("button", { name: "Move forward" });
  const front = page.getByRole("button", { name: "Fire front cannon" });
  await forward.dispatchEvent("pointerdown", {
    pointerId: 1,
    pointerType: "touch",
  });
  await front.dispatchEvent("pointerdown", {
    pointerId: 2,
    pointerType: "touch",
  });
  await step(page, 1);
  expect((await snapshot(page)).projectiles.length).toBeGreaterThan(0);
  await step(page, 30);
  expect((await snapshot(page)).player.x).toBeGreaterThan(initial.player.x);
  await forward.dispatchEvent("pointerup", {
    pointerId: 1,
    pointerType: "touch",
  });
  await front.dispatchEvent("pointerup", {
    pointerId: 2,
    pointerType: "touch",
  });
});

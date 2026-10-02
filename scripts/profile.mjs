import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const port = 4174;
const baseUrl = `http://127.0.0.1:${port}`;
const vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  stdio: "ignore",
  windowsHide: true,
});

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch { /* The preview server is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Vite preview did not start.");
}

async function readMemory(page) {
  return page.evaluate(() => performance.memory?.usedJSHeapSize ?? null);
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("pirate-battle.options.v1", JSON.stringify({
      sessionDurationSeconds: 180,
      enemySpawnIntervalSeconds: 10,
    }));
  });
  await page.goto(`${baseUrl}/?profile=1`, { waitUntil: "networkidle" });
  const beforeCycles = await readMemory(page);
  for (let cycle = 0; cycle < 5; cycle += 1) {
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.locator(".battle-stage canvas").waitFor();
    await page.getByRole("button", { name: "Main Menu" }).click();
    await page.getByRole("button", { name: "Leave Game" }).click();
  }
  const afterCycles = await readMemory(page);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.locator(".battle-stage canvas").waitFor();
  await page.keyboard.down("w");
  await page.keyboard.down("a");
  await page.waitForTimeout(180_000);
  await page.keyboard.up("a");
  await page.keyboard.up("w");
  const profile = await page.evaluate(() => window.__pirateBattleProfile?.snapshot());
  const resultVisible = await page.getByRole("heading", { name: "Battle Result" }).isVisible().catch(() => false);
  const report = {
    capturedAt: new Date().toISOString(),
    environment: {
      browser: await browser.version(),
      viewport: "1440x900",
      mode: "Chromium headless, Vite production preview",
    },
    configuration: { durationSeconds: 180, enemySpawnIntervalSeconds: 10 },
    performance: profile,
    memoryBytes: { beforeFiveCycles: beforeCycles, afterFiveCycles: afterCycles },
    completedMatch: resultVisible,
  };
  await writeFile("reports/profiling.json", `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
} finally {
  vite.kill();
}

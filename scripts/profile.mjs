import { spawn } from "node:child_process";
import os from "node:os";
import { writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const port = 4174;
const baseUrl = `http://127.0.0.1:${port}`;
const headless = process.argv.includes("--headless");
const durationSeconds = 180;
const viewport = { width: 1440, height: 900 };
const vite = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  { stdio: "ignore", windowsHide: true },
);

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

async function heapBytes(cdp) {
  try {
    await cdp.send("HeapProfiler.collectGarbage");
    const { metrics } = await cdp.send("Performance.getMetrics");
    return metrics.find((metric) => metric.name === "JSHeapUsedSize")?.value ?? null;
  } catch {
    return null;
  }
}

async function gpuInfo(browser) {
  try {
    const cdp = await browser.newBrowserCDPSession();
    const info = await cdp.send("SystemInfo.getInfo");
    return info.gpu?.devices?.map((device) => device.deviceString).filter(Boolean) ?? null;
  } catch {
    return null;
  }
}

async function resourceState(page) {
  return page.evaluate(() => ({
    canvasCount: document.querySelectorAll("canvas").length,
    battleCanvasCount: document.querySelectorAll(".battle-stage canvas").length,
    profileStatus: window.__pirateBattleProfileStatus ?? null,
  }));
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  await page.addInitScript((options) => {
    localStorage.setItem("pirate-battle.options.v1", JSON.stringify(options));
  }, { sessionDurationSeconds: durationSeconds, enemySpawnIntervalSeconds: 10 });
  await page.goto(`${baseUrl}/?profile=1`, { waitUntil: "networkidle" });

  const beforeCycles = await heapBytes(cdp);
  const cycles = [];
  for (let cycle = 0; cycle < 5; cycle += 1) {
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.locator(".battle-stage canvas").waitFor();
    await page.getByRole("button", { name: "Main Menu" }).click();
    await page.getByRole("button", { name: "Leave Game" }).click();
    cycles.push({
      ...(await resourceState(page)),
      heapAfterBytes: await heapBytes(cdp),
    });
  }
  const afterCycles = await heapBytes(cdp);

  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.locator(".battle-stage canvas").waitFor();
  await page.keyboard.down("w");
  await page.keyboard.down("a");
  await page.waitForTimeout(durationSeconds * 1000 + 1_000);
  await page.keyboard.up("a");
  await page.keyboard.up("w");
  const profile = await page.evaluate(() => window.__pirateBattleProfile?.snapshot() ?? null);
  const resultVisible = await page.getByRole("heading", { name: "Battle Complete" }).isVisible().catch(() => false);
  const framesPerSecond = profile && profile.meanFrameMs > 0 ? 1000 / profile.meanFrameMs : null;
  const report = {
    capturedAt: new Date().toISOString(),
    environment: {
      browser: await browser.version(),
      viewport: `${viewport.width}x${viewport.height}`,
      devicePixelRatio: await page.evaluate(() => window.devicePixelRatio),
      mode: headless ? "Chromium headless, Vite production preview" : "Chromium visible, Vite production preview",
      operatingSystem: `${os.type()} ${os.release()}`,
      cpu: os.cpus()[0]?.model ?? null,
      gpu: await gpuInfo(browser),
    },
    configuration: {
      durationSeconds,
      enemySpawnIntervalSeconds: 10,
      profilePlayerInvulnerable: true,
    },
    performance: profile && {
      ...profile,
      framesPerSecond,
    },
    memoryBytes: { beforeFiveCycles: beforeCycles, afterFiveCycles: afterCycles },
    cleanupAfterFiveCycles: cycles,
    completedMatch: resultVisible,
    validThreeMinuteCapture: Boolean(
      resultVisible && profile?.endReason === "time" && profile.activeDurationSeconds >= durationSeconds,
    ),
    referenceEligible: !headless,
    meetsReferencePerformanceTarget: Boolean(
      !headless && profile && framesPerSecond !== null && framesPerSecond >= 58 && profile.p95FrameMs <= 20,
    ),
  };
  await writeFile("reports/profiling.json", `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
} finally {
  vite.kill();
}

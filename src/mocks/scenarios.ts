export const SCENARIOS = [
  ["success", "Success"],
  ["empty", "Empty lists"],
  ["multiple-pages", "Multiple pages"],
  ["slow", "Slow responses"],
  ["variable-latency", "Variable latency"],
  ["out-of-order", "Out-of-order responses"],
  ["timeout", "Timeout"],
  ["connection-error", "Connection error"],
  ["http-400", "HTTP 400"],
  ["http-500", "HTTP 500"],
  ["ranking-error", "Ranking unavailable"],
  ["history-error", "History unavailable"],
  ["post-commit-timeout", "Timeout after recording"],
  ["unavailable-on-post", "Unavailable on completion"],
] as const;

export type Scenario = (typeof SCENARIOS)[number][0];
export const SCENARIO_STORAGE_KEY = "pirate-battle.network.v1";

export function loadScenario(): Scenario {
  try {
    const stored = localStorage.getItem(SCENARIO_STORAGE_KEY);
    if (SCENARIOS.some(([id]) => id === stored)) return stored as Scenario;
  } catch { /* Browser storage is optional for this demo control. */ }
  return "success";
}

export function saveScenario(scenario: Scenario) {
  try { localStorage.setItem(SCENARIO_STORAGE_KEY, scenario); } catch { /* Keep the in-memory choice. */ }
  currentScenario = scenario;
  requestCount = 0;
  generation += 1;
}

let currentScenario: Scenario | null = null;
let requestCount = 0;
let generation = 0;

export function activeScenario() {
  return currentScenario ?? loadScenario();
}

export function nextRequestNumber() {
  requestCount += 1;
  return requestCount;
}

export function scenarioGeneration() { return generation; }

export function networkTiming() {
  const params = new URLSearchParams(location.search);
  const read = (name: string, fallback: number) => {
    const raw = params.get(name);
    const value = raw === null ? NaN : Number(raw);
    return Number.isInteger(value) && value >= 0 && value <= 5000 ? value : fallback;
  };
  return { seed: read("networkSeed", 41), delayMs: read("networkDelayMs", 0) };
}

export function resetScenario() {
  saveScenario("success");
}

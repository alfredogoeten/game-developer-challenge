import { delay, http, HttpResponse, passthrough } from "msw";
import { configurationKey, paginate, PAGE_SIZE, type RankingEntry } from "../features/matches/contracts";
import { isMatchRecord } from "../features/matches/matchStorage";
import type { MatchRecord } from "../features/matches/model";
import { FIXTURE_MATCHES, PLAYER_NAMES } from "./fixtures";
import { activeScenario, networkTiming, nextRequestNumber, scenarioGeneration, type Scenario } from "./scenarios";
import { confirmRemoteMatch, confirmedMatches } from "./store";

function pageNumber(request: Request) {
  const number = Number(new URL(request.url).searchParams.get("page"));
  return Number.isInteger(number) && number > 0 && number <= 1000 ? number : null;
}

function pageSize(request: Request) {
  const value = new URL(request.url).searchParams.get("pageSize");
  if (value === null) return PAGE_SIZE;
  const number = Number(value);
  return number === 2 || number === PAGE_SIZE ? number : null;
}

async function networkCondition(scenario: Scenario, operation: "ranking" | "history" | "post", ordinal: number) {
  const { seed, delayMs } = networkTiming();
  if (scenario === "slow") await delay(delayMs || 700);
  if (scenario === "variable-latency") await delay(80 + ((ordinal * 137 + seed) % 5) * (delayMs || 120));
  if (scenario === "out-of-order") await delay(ordinal % 2 ? delayMs || 850 : 60);
  if (scenario === "timeout" && operation !== "post") await delay(Math.max(1300, delayMs || 1800));
  if (scenario === "connection-error") return HttpResponse.error();
  if (scenario === "http-400") return HttpResponse.json({ error: "Invalid request" }, { status: 400 });
  if (scenario === "http-500") return HttpResponse.json({ error: "Server unavailable" }, { status: 500 });
  if (scenario === "ranking-error" && operation === "ranking")
    return HttpResponse.json({ error: "Ranking unavailable" }, { status: 503 });
  if (scenario === "history-error" && operation === "history")
    return HttpResponse.json({ error: "History unavailable" }, { status: 503 });
  if (scenario === "unavailable-on-post" && operation === "post")
    return HttpResponse.json({ error: "Registration unavailable" }, { status: 503 });
  return null;
}

export const handlers = [
  http.get("/", () => passthrough()),
  http.get("/api/ranking", async ({ request }) => {
    const scenario = activeScenario();
    const ordinal = nextRequestNumber();
    const page = pageNumber(request);
    const size = pageSize(request);
    const config = new URL(request.url).searchParams.get("config");
    if (!page || !size || !config) return HttpResponse.json({ error: "Invalid pagination or configuration" }, { status: 400 });
    const records = scenario === "empty" ? [] : [...FIXTURE_MATCHES, ...confirmedMatches()]
      .filter((item) => configurationKey(item) === config)
      .sort((a, b) => b.score - a.score || a.completedAt.localeCompare(b.completedAt) || a.matchId.localeCompare(b.matchId));
    const entries: RankingEntry[] = records.map((item, index) => ({
      ...item, rank: index + 1, playerName: PLAYER_NAMES[item.playerId] ?? "You",
    }));
    const response = paginate(entries, page, size);
    const failure = await networkCondition(scenario, "ranking", ordinal);
    return failure ?? HttpResponse.json(response);
  }),
  http.get("/api/matches", async ({ request }) => {
    const scenario = activeScenario();
    const ordinal = nextRequestNumber();
    const page = pageNumber(request);
    const size = pageSize(request);
    const playerId = new URL(request.url).searchParams.get("playerId");
    if (!page || !size || !playerId) return HttpResponse.json({ error: "Invalid pagination or player" }, { status: 400 });
    const sampleHistory = scenario === "multiple-pages"
      ? FIXTURE_MATCHES.slice(0, 12).map((item) => ({ ...item, matchId: `sample-history-${item.matchId}`, playerId }))
      : [];
    const records = scenario === "empty" ? [] : [...sampleHistory, ...confirmedMatches()]
      .filter((item) => item.playerId === playerId)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt) || a.matchId.localeCompare(b.matchId));
    const response = paginate(records, page, size);
    const failure = await networkCondition(scenario, "history", ordinal);
    return failure ?? HttpResponse.json(response);
  }),
  http.post("/api/matches", async ({ request }) => {
    const scenario = activeScenario();
    const generation = scenarioGeneration();
    const ordinal = nextRequestNumber();
    let record: unknown;
    try { record = await request.json(); } catch { return HttpResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
    if (!isMatchRecord(record)) return HttpResponse.json({ error: "Invalid match" }, { status: 400 });
    const failure = await networkCondition(scenario, "post", ordinal);
    if (failure) return failure;
    if (generation !== scenarioGeneration()) return HttpResponse.json({ error: "Scenario changed" }, { status: 409 });
    try {
      const outcome = confirmRemoteMatch(record as MatchRecord);
      if (scenario === "post-commit-timeout" && outcome.created) await delay(Math.max(1300, networkTiming().delayMs || 1800));
      return HttpResponse.json(outcome.record, { status: outcome.created ? 201 : 200 });
    } catch {
      return HttpResponse.json({ error: "Storage unavailable" }, { status: 503 });
    }
  }),
];

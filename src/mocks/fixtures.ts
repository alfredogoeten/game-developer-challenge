import { createGameBalance } from "../features/battle/gameBalance";
import { DEFAULT_GAME_OPTIONS, type GameOptions } from "../features/options/gameOptions";
import type { MatchRecord } from "../features/matches/model";

export const PLAYER_NAMES: Record<string, string> = {
  "fixture-ada": "Captain Ada",
  "fixture-lee": "Captain Lee",
  "fixture-morgan": "Captain Morgan",
  "fixture-kai": "Captain Kai",
};

const otherOptions: GameOptions = { sessionDurationSeconds: 60, enemySpawnIntervalSeconds: 5 };

function fixture(index: number, options: GameOptions): MatchRecord {
  const players = Object.keys(PLAYER_NAMES);
  return {
    matchId: `fixture-${options.sessionDurationSeconds}-${index}`,
    playerId: players[index % players.length],
    completedAt: new Date(Date.UTC(2026, 8, index + 1, 12)).toISOString(),
    score: 15 - index,
    durationSeconds: options.sessionDurationSeconds,
    endReason: "time",
    options,
    balance: createGameBalance(options),
  };
}

export const FIXTURE_MATCHES: MatchRecord[] = [
  ...Array.from({ length: 12 }, (_, index) => fixture(index, DEFAULT_GAME_OPTIONS)),
  ...Array.from({ length: 3 }, (_, index) => fixture(index, otherOptions)),
];

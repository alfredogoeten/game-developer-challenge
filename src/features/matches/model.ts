import type { GameBalance } from "../battle/gameBalance";
import type { GameOptions } from "../options/gameOptions";
import type { EndReason } from "../battle/model";

export type MatchRecord = {
  matchId: string;
  playerId: string;
  completedAt: string;
  score: number;
  durationSeconds: number;
  endReason: EndReason;
  options: GameOptions;
  balance: GameBalance;
};

export type LocalMatches = {
  playerId: string;
  lastCompleted: MatchRecord | null;
  pending: MatchRecord[];
};

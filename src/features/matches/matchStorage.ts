import type { LocalMatches, MatchRecord } from "./model";

export const MATCH_STORAGE_KEY = "pirate-battle.matches.v1";

export function loadLocalMatches(): LocalMatches {
  try {
    const stored = window.localStorage.getItem(MATCH_STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (isLocalMatches(parsed)) return parsed;
    }
  } catch {
    /* Unavailable storage starts a local-only session. */
  }
  return { playerId: crypto.randomUUID(), lastCompleted: null, pending: [] };
}

export function storeCompletedMatch(
  current: LocalMatches,
  match: MatchRecord,
): { state: LocalMatches; saved: boolean } {
  const state: LocalMatches = {
    playerId: current.playerId,
    lastCompleted: match,
    pending: current.pending.some((item) => item.matchId === match.matchId)
      ? current.pending
      : [...current.pending, match],
  };
  try {
    window.localStorage.setItem(MATCH_STORAGE_KEY, JSON.stringify(state));
    return { state, saved: true };
  } catch {
    return { state, saved: false };
  }
}

export function confirmMatch(
  current: LocalMatches,
  matchId: string,
): { state: LocalMatches; saved: boolean } {
  const state = {
    ...current,
    pending: current.pending.filter((item) => item.matchId !== matchId),
  };
  try {
    window.localStorage.setItem(MATCH_STORAGE_KEY, JSON.stringify(state));
    return { state, saved: true };
  } catch {
    return { state: current, saved: false };
  }
}

function isLocalMatches(value: unknown): value is LocalMatches {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<LocalMatches>;
  return (
    typeof item.playerId === "string" &&
    Array.isArray(item.pending) &&
    item.pending.every(isMatchRecord) &&
    (item.lastCompleted === null || isMatchRecord(item.lastCompleted))
  );
}

export function isMatchRecord(value: unknown): value is MatchRecord {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<MatchRecord>;
  return (
    typeof item.matchId === "string" &&
    typeof item.playerId === "string" &&
    typeof item.completedAt === "string" &&
    typeof item.score === "number" &&
    typeof item.durationSeconds === "number" &&
    (item.endReason === "time" || item.endReason === "death") &&
    !!item.options &&
    !!item.balance
  );
}

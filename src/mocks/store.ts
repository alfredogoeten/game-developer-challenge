import { isMatchRecord } from "../features/matches/matchStorage";
import type { MatchRecord } from "../features/matches/model";

export const CONFIRMED_STORAGE_KEY = "pirate-battle.confirmed.v1";

export function confirmedMatches(): MatchRecord[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CONFIRMED_STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value.filter(isMatchRecord) : [];
  } catch {
    return [];
  }
}

export function confirmRemoteMatch(record: MatchRecord) {
  const confirmed = confirmedMatches();
  const existing = confirmed.find((item) => item.matchId === record.matchId);
  if (existing) return { record: existing, created: false };
  localStorage.setItem(CONFIRMED_STORAGE_KEY, JSON.stringify([...confirmed, record]));
  return { record, created: true };
}

export function resetConfirmedMatches() {
  try { localStorage.removeItem(CONFIRMED_STORAGE_KEY); } catch { /* Keep the UI usable. */ }
}

import axios from "axios";
import type { GameBalance } from "../battle/gameBalance";
import type { GameOptions } from "../options/gameOptions";
import { configurationKey, type Page, type RankingEntry } from "./contracts";
import type { MatchRecord } from "./model";

const http = axios.create({ baseURL: "/api", timeout: 1200 });

export async function getRanking(
  options: GameOptions,
  balance: GameBalance,
  page: number,
  pageSize: number,
  signal: AbortSignal,
) {
  const result = await http.get<Page<RankingEntry>>("/ranking", {
    params: { config: configurationKey({ options, balance }), page, pageSize },
    signal,
  });
  return result.data;
}

export async function getHistory(playerId: string, page: number, pageSize: number, signal: AbortSignal) {
  const result = await http.get<Page<MatchRecord>>("/matches", {
    params: { playerId, page, pageSize },
    signal,
  });
  return result.data;
}

export async function registerMatch(record: MatchRecord) {
  const result = await http.post<MatchRecord>("/matches", record);
  return result.data;
}

export function shouldRetry(failureCount: number, error: unknown) {
  if (failureCount >= 2 || !axios.isAxiosError(error)) return false;
  return !error.response || error.response.status >= 500;
}

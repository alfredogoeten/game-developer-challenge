import type { MatchRecord } from "./model";

export const PAGE_SIZE = 5;

export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type RankingEntry = MatchRecord & { playerName: string; rank: number };

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}

export function configurationKey(record: Pick<MatchRecord, "options" | "balance">) {
  return JSON.stringify(canonical({ options: record.options, balance: record.balance }));
}

export function paginate<T>(items: T[], page: number): Page<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  return {
    items: items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    page,
    pageSize: PAGE_SIZE,
    total: items.length,
    totalPages,
  };
}

import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createGameBalance } from "../battle/gameBalance";
import { getHistory, getRanking, shouldRetry } from "../matches/api";
import {
  configurationKey,
  type Page,
  type RankingEntry,
} from "../matches/contracts";
import type { MatchRecord } from "../matches/model";
import type { GameOptions } from "../options/gameOptions";

const COMPACT_RECORDS = "(max-width: 600px), (max-height: 600px) and (max-width: 900px)";
function currentPageSize() {
  return window.matchMedia(COMPACT_RECORDS).matches ? 2 : 5;
}

type RecordScreenKind = "ranking" | "history";

type RecordsScreenProps = {
  kind: RecordScreenKind;
  options: GameOptions;
  playerId: string;
  scenarioEpoch: number;
  onReturnToMenu: () => void;
  onOpenRanking: () => void;
  onOpenHistory: () => void;
};

export function RecordsScreen({
  kind,
  options,
  playerId,
  scenarioEpoch,
  onReturnToMenu,
  onOpenRanking,
  onOpenHistory,
}: RecordsScreenProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(currentPageSize);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const isRanking = kind === "ranking";
  const title = isRanking ? "Ranking" : "Match History";
  const balance = useMemo(() => createGameBalance(options), [options]);
  const config = useMemo(
    () => configurationKey({ options, balance }),
    [options, balance],
  );
  useEffect(() => {
    const media = window.matchMedia(COMPACT_RECORDS);
    const update = () => {
      setPage(1);
      setPageSize(media.matches ? 2 : 5);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const ranking = useQuery({
    queryKey: ["ranking", config, page, pageSize, scenarioEpoch],
    queryFn: ({ signal }) => getRanking(options, balance, page, pageSize, signal),
    enabled: isRanking,
    staleTime: 30_000,
    refetchOnMount: "always",
    retry: shouldRetry,
    placeholderData: pageSize === 5 ? keepPreviousData : undefined,
  });
  const history = useQuery({
    queryKey: ["history", playerId, page, pageSize, scenarioEpoch],
    queryFn: ({ signal }) => getHistory(playerId, page, pageSize, signal),
    enabled: !isRanking,
    staleTime: 30_000,
    refetchOnMount: "always",
    retry: shouldRetry,
    placeholderData: pageSize === 5 ? keepPreviousData : undefined,
  });
  const query = isRanking ? ranking : history;
  const data = query.data as Page<RankingEntry | MatchRecord> | undefined;

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || event.repeat)
        return;
      event.preventDefault();
      onReturnToMenu();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onReturnToMenu]);

  return (
    <section className="menu-panel records-screen" aria-labelledby="records-title">
      <button
        aria-label="Back to main menu"
        aria-keyshortcuts="Escape"
        className="back-button"
        onClick={onReturnToMenu}
        title="Back to main menu (Esc)"
        type="button"
      >
        <span aria-hidden="true" className="back-button__arrow" />
      </button>
      <h1 id="records-title" ref={titleRef} tabIndex={-1}>
        {title}
      </h1>
      <nav aria-label="Captain's log sections" className="records-tabs">
        <button
          aria-current={isRanking ? "page" : undefined}
          className="asset-button asset-button--secondary"
          onClick={onOpenRanking}
          type="button"
        >
          Ranking
        </button>
        <button
          aria-current={!isRanking ? "page" : undefined}
          className="asset-button asset-button--secondary"
          onClick={onOpenHistory}
          type="button"
        >
          Match History
        </button>
      </nav>
      {isRanking ? (
        <p className="records-context">
          Current options: {options.sessionDurationSeconds}s game, {" "}
          {options.enemySpawnIntervalSeconds}s spawns.
        </p>
      ) : (
        <p className="records-context">Your completed matches.</p>
      )}

      <section aria-label={title} className="records-panel">
        <div className="records-content" aria-busy={query.isFetching}>
        {query.isPending ? (
          <p role="status">Loading {title.toLowerCase()}…</p>
        ) : null}
        {query.isError ? (
          <div role="alert">
            <p>Could not load {title.toLowerCase()}.</p>
            <button
              className="asset-button asset-button--primary"
              onClick={() => void query.refetch()}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : null}
        {data?.items.length === 0 ? (
          <p>
            No {isRanking ? "ranking entries" : "completed matches"} to show.
          </p>
        ) : null}
        {data && data.items.length > 0 ? (
          <>
            {isRanking ? (
              <ol className="records-list" start={(page - 1) * pageSize + 1}>
                {(data.items as RankingEntry[]).map((entry) => (
                  <li key={entry.matchId}>
                    <span>
                      #{entry.rank} {entry.playerId === playerId ? "You" : entry.playerName}
                    </span>
                    <strong>{entry.score} pts</strong>
                  </li>
                ))}
              </ol>
            ) : (
              <ol className="records-list">
                {(data.items as MatchRecord[]).map((entry) => (
                  <li key={entry.matchId}>
                    <span>
                      <time dateTime={entry.completedAt}>
                        {new Date(entry.completedAt).toLocaleDateString("en-US")}
                      </time>{" "}
                      · {entry.endReason === "time" ? "Time expired" : "Ship destroyed"}
                      <small>
                        {Math.ceil(entry.durationSeconds)}s · {" "}
                        {entry.options.sessionDurationSeconds}s game / {" "}
                        {entry.options.enemySpawnIntervalSeconds}s spawns
                      </small>
                    </span>
                    <strong>{entry.score} pts</strong>
                  </li>
                ))}
              </ol>
            )}
          </>
        ) : null}
        </div>
        {data ? (
          <nav aria-label={`${title} pages`} className="records-pagination">
            <button
              aria-label="Previous page"
              className="hud-button records-pagination__button records-pagination__button--previous"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              <span aria-hidden="true" className="records-pagination__icon" />
            </button>
            <span>
              Page {data.page} of {data.totalPages}
            </span>
            <button
              aria-label="Next page"
              className="hud-button records-pagination__button"
              disabled={page >= data.totalPages}
              onClick={() =>
                setPage((current) => Math.min(data.totalPages, current + 1))
              }
              type="button"
            >
              <span aria-hidden="true" className="records-pagination__icon" />
            </button>
          </nav>
        ) : null}
      </section>
    </section>
  );
}

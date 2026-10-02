import { useEffect, useRef } from "react";
import type { MatchRecord } from "./model";

type ResultScreenProps = {
  record: MatchRecord;
  saved: boolean;
  pending: boolean;
  syncing: boolean;
  onRetrySave: () => void;
  onRetrySync: () => void;
  onPlayAgain: () => void;
  onMainMenu: () => void;
};

export function ResultScreen({
  record,
  saved,
  pending,
  syncing,
  onRetrySave,
  onRetrySync,
  onPlayAgain,
  onMainMenu,
}: ResultScreenProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <section className="menu-panel result-panel" aria-labelledby="result-title">
      <h1 id="result-title" ref={titleRef} tabIndex={-1}>
        Battle Complete
      </h1>
      <p className="result-score">
        {record.score} <span>points</span>
      </p>
      <dl className="result-details">
        <div>
          <dt>Time played</dt>
          <dd>{Math.ceil(record.durationSeconds)}s</dd>
        </div>
        <div>
          <dt>Ended by</dt>
          <dd>
            {record.endReason === "time" ? "Time expired" : "Ship destroyed"}
          </dd>
        </div>
        <div>
          <dt>Match record</dt>
          <dd>{!saved ? "Storage error" : pending ? "Pending" : "Recorded"}</dd>
        </div>
      </dl>
      {saved && pending ? (
        <p className="result-note">
          Your match is saved locally and awaits ranking and history sync.
        </p>
      ) : !saved ? (
        <p className="form-message form-message--error" role="alert">
          Your result could not be saved locally. Please try again.
        </p>
      ) : <p className="result-note">Your match is recorded in Ranking and Match History.</p>}
      {!saved ? (
        <button
          className="asset-button asset-button--primary"
          onClick={onRetrySave}
          type="button"
        >
          Retry Save
        </button>
      ) : null}
      {saved && pending ? <button className="asset-button asset-button--primary" disabled={syncing} onClick={onRetrySync} type="button">{syncing ? "Syncing…" : "Retry Sync"}</button> : null}
      <div className="result-actions">
        <button
          className="asset-button asset-button--primary"
          onClick={onPlayAgain}
          type="button"
        >
          Play Again
        </button>
        <button
          className="asset-button asset-button--primary"
          onClick={onMainMenu}
          type="button"
        >
          Main Menu
        </button>
      </div>
    </section>
  );
}

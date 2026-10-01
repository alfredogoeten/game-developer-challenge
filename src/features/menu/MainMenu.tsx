import type { RefObject } from "react";

const CONTROL_HINTS = [
  ["Move forward", "W or ↑"],
  ["Turn", "A / D or ← / →"],
  ["Front cannon", "Space"],
  ["Broadside cannons", "Q / E"],
  ["Pause", "Esc"],
];

type MainMenuProps = {
  hasLastResult: boolean;
  onOpenLastResult: () => void;
  onOpenOptions: () => void;
  onPlay: () => void;
  optionsButtonRef: RefObject<HTMLButtonElement | null>;
  statusMessage: string;
};

export function MainMenu({
  hasLastResult,
  onOpenLastResult,
  onOpenOptions,
  onPlay,
  optionsButtonRef,
  statusMessage,
}: MainMenuProps) {
  return (
    <section className="menu-panel" aria-labelledby="menu-title">
      <h1 className="sr-only" id="menu-title">
        Pirate Battle
      </h1>
      <div className="game-title" aria-hidden="true" />

      <div className="menu-actions" aria-label="Main menu actions">
        <button
          className="asset-button asset-button--primary"
          onClick={onPlay}
          type="button"
        >
          Play
        </button>
        <button
          className="asset-button asset-button--primary"
          onClick={onOpenOptions}
          ref={optionsButtonRef}
          type="button"
        >
          Options
        </button>
        {hasLastResult ? (
          <button
            className="asset-button asset-button--secondary"
            onClick={onOpenLastResult}
            type="button"
          >
            Last Result
          </button>
        ) : null}
      </div>

      <section className="controls-guide" aria-labelledby="controls-title">
        <h2 id="controls-title">Controls</h2>
        <dl>
          {CONTROL_HINTS.map(([action, key]) => (
            <div key={action}>
              <dt>{action}</dt>
              <dd>{key}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div
        className="menu-footer-actions"
        aria-label="Unavailable menu sections"
      >
        <button
          className="asset-button asset-button--secondary"
          disabled
          type="button"
        >
          Ranking
        </button>
        <button
          className="asset-button asset-button--secondary"
          disabled
          type="button"
        >
          Match History
        </button>
      </div>

      <p aria-live="polite" className="screen-reader-status" role="status">
        {statusMessage}
      </p>
    </section>
  );
}

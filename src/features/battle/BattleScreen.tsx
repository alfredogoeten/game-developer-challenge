import { Application } from "pixi.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { createGameBalance } from "./gameBalance";
import type { GameOptions } from "../options/gameOptions";
import { loadBattleTextures } from "./assets";
import { BattleRenderer } from "./BattleRenderer";
import { GameSimulation } from "./GameSimulation";
import type { Action, GameSnapshot } from "./model";
import { InputController } from "./InputController";
import type { BattleTestBridge } from "./testBridge";

type BattleScreenProps = {
  options: GameOptions;
  onFinish: (snapshot: GameSnapshot) => void;
  onExit: () => void;
};

const TOUCH_CONTROLS: { action: Action; label: string; icon: string }[] = [
  { action: "turnLeft", label: "Turn left", icon: "↶" },
  { action: "forward", label: "Move forward", icon: "↑" },
  { action: "turnRight", label: "Turn right", icon: "↷" },
  { action: "port", label: "Fire left broadside", icon: "◀" },
  { action: "front", label: "Fire front cannon", icon: "●" },
  { action: "starboard", label: "Fire right broadside", icon: "▶" },
];

function isPortraitMobile() {
  return window.matchMedia("(pointer: coarse) and (orientation: portrait)")
    .matches;
}

export function BattleScreen({ options, onFinish, onExit }: BattleScreenProps) {
  const balance = useMemo(() => createGameBalance(options), [options]);
  const mountRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<GameSimulation | null>(null);
  const inputRef = useRef<InputController | null>(null);
  const onFinishRef = useRef(onFinish);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [progress, setProgress] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [ready, setReady] = useState(false);
  const [hud, setHud] = useState<GameSnapshot | null>(null);
  const [portrait, setPortrait] = useState(isPortraitMobile);
  const [exitDialog, setExitDialog] = useState(false);
  const exitDialogRef = useRef(false);
  const resumeButtonRef = useRef<HTMLButtonElement>(null);
  const exitCancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);
  useEffect(() => {
    exitDialogRef.current = exitDialog;
  }, [exitDialog]);

  useEffect(() => {
    let disposed = false;
    let application: Application | null = null;
    let applicationReady = false;
    let input: InputController | null = null;
    let accumulator = 0;
    let lastHudUpdate = 0;
    let bridge: BattleTestBridge | null = null;
    const simulation = new GameSimulation(
      balance,
      import.meta.env.DEV && new URLSearchParams(location.search).has("e2e")
        ? 12345
        : Date.now(),
    );
    simulationRef.current = simulation;
    if (isPortraitMobile()) simulation.setPaused(true);

    const publish = (force = false) => {
      if (disposed) return;
      const now = performance.now();
      if (force || now - lastHudUpdate >= 100) {
        setHud(simulation.snapshot());
        lastHudUpdate = now;
      }
    };

    const finishIfEnded = () => {
      if (!simulation.ended || disposed) return;
      input?.clear();
      publish(true);
      onFinishRef.current(simulation.snapshot());
    };

    async function initialize() {
      try {
        setReady(false);
        setLoadError("");
        setProgress(0);
        const textures = await loadBattleTextures((value) => {
          if (!disposed) setProgress(value);
        });
        if (disposed) return;
        const app = new Application();
        application = app;
        await app.init({
          width: balance.arena.width,
          height: balance.arena.height,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          autoDensity: true,
          backgroundColor: 0x146687,
          antialias: true,
        });
        applicationReady = true;
        if (disposed) {
          app.destroy(true, { children: true });
          return;
        }
        const renderer = new BattleRenderer(app, textures, balance);
        mountRef.current?.appendChild(app.canvas);
        renderer.render(simulation.snapshot());
        app.render();
        input = new InputController(
          () => !simulation.paused && !simulation.ended && !isPortraitMobile(),
          () => {
            if (exitDialogRef.current) return;
            input?.clear();
            simulation.setPaused(!simulation.paused);
            publish(true);
          },
          () => {
            simulation.setPaused(true);
            input?.clear();
            publish(true);
          },
        );
        inputRef.current = input;
        const e2e =
          import.meta.env.DEV &&
          new URLSearchParams(location.search).has("e2e");
        if (e2e) {
          app.ticker.stop();
          bridge = {
            snapshot: () => simulation.snapshot(),
            step: (ticks) => {
              for (
                let index = 0;
                index < Math.max(0, Math.min(30000, Math.floor(ticks)));
                index += 1
              ) {
                simulation.step(
                  1 / 60,
                  input?.getActions() ?? new Set<Action>(),
                );
                if (simulation.ended) break;
              }
              renderer.render(simulation.snapshot());
              app.render();
              publish(true);
              finishIfEnded();
            },
            spawn: (kind, x, y) => {
              simulation.debugSpawn(kind, x, y);
              renderer.render(simulation.snapshot());
              app.render();
              publish(true);
            },
            setElapsed: (seconds) => {
              simulation.elapsed = Math.max(
                0,
                Math.min(balance.duration, seconds),
              );
              publish(true);
            },
          };
          window.__pirateBattleTest = bridge;
        } else {
          app.ticker.add((ticker) => {
            if (simulation.paused || simulation.ended) {
              accumulator = 0;
              publish();
              return;
            }
            accumulator = Math.min(accumulator + ticker.deltaMS / 1000, 0.25);
            let iterations = 0;
            while (accumulator >= 1 / 60 && iterations < 8) {
              simulation.step(1 / 60, input?.getActions() ?? new Set<Action>());
              accumulator -= 1 / 60;
              iterations += 1;
              if (simulation.ended) break;
            }
            renderer.render(simulation.snapshot());
            publish();
            finishIfEnded();
          });
        }
        setReady(true);
        publish(true);
      } catch (error) {
        if (!disposed)
          setLoadError(
            error instanceof Error
              ? error.message
              : "Could not load battle assets.",
          );
      }
    }
    void initialize();
    return () => {
      disposed = true;
      input?.destroy();
      inputRef.current = null;
      if (window.__pirateBattleTest === bridge)
        delete window.__pirateBattleTest;
      if (applicationReady) application?.destroy(true, { children: true });
      simulationRef.current = null;
    };
  }, [balance, loadAttempt]);

  useEffect(() => {
    const checkOrientation = () => {
      const next = isPortraitMobile();
      setPortrait(next);
      if (next) {
        simulationRef.current?.setPaused(true);
        inputRef.current?.clear();
        if (simulationRef.current) setHud(simulationRef.current.snapshot());
      }
    };
    window.addEventListener("resize", checkOrientation);
    return () => window.removeEventListener("resize", checkOrientation);
  }, []);

  useEffect(() => {
    if (exitDialog) exitCancelRef.current?.focus();
    else if (hud?.paused && ready && !portrait)
      resumeButtonRef.current?.focus();
  }, [exitDialog, hud?.paused, ready, portrait]);

  function togglePause() {
    const simulation = simulationRef.current;
    if (!simulation || simulation.ended || portrait) return;
    inputRef.current?.clear();
    simulation.setPaused(!simulation.paused);
    setHud(simulation.snapshot());
  }

  function handleTouchDown(
    event: React.PointerEvent<HTMLButtonElement>,
    action: Action,
  ) {
    event.preventDefault();
    inputRef.current?.pressPointer(event.pointerId, action);
  }

  function handleTouchUp(event: React.PointerEvent<HTMLButtonElement>) {
    inputRef.current?.releasePointer(event.pointerId);
  }

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && exitDialog) {
      event.preventDefault();
      event.stopPropagation();
      setExitDialog(false);
      return;
    }
    if (event.key !== "Tab") return;
    const buttons = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      ),
    ];
    if (!buttons.length) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const remaining = Math.ceil(hud?.remaining ?? balance.duration);
  return (
    <section className="battle-screen" aria-label="Pirate Battle game">
      <header
        className="battle-hud"
        inert={Boolean(hud?.paused || exitDialog || portrait || !ready)}
      >
        <strong>
          Health:{" "}
          <span data-testid="health">
            {hud?.player.health ?? balance.player.health}
          </span>{" "}
          / {balance.player.health}
        </strong>
        <strong>
          Score: <span data-testid="score">{hud?.score ?? 0}</span>
        </strong>
        <strong>
          Time: <span data-testid="time">{remaining}</span>s
        </strong>
        <button
          aria-label={hud?.paused ? "Resume game" : "Pause game"}
          className="hud-button"
          disabled={!ready || portrait}
          onClick={togglePause}
          type="button"
        >
          {hud?.paused ? "Resume" : "Pause"}
        </button>
        <button
          className="hud-button"
          onClick={() => {
            togglePauseIfRunning();
            setExitDialog(true);
          }}
          type="button"
        >
          Main Menu
        </button>
      </header>
      <div
        className="battle-stage"
        ref={mountRef}
        role="img"
        aria-label="Ocean arena with two blocking islands, ships and cannonballs"
      />
      {!ready && !loadError ? (
        <div className="battle-overlay" role="status">
          <p>Loading battle assets… {progress}%</p>
          <progress max="100" value={progress} />
        </div>
      ) : null}
      {loadError ? (
        <div className="battle-overlay" role="alert">
          <p>Battle assets could not be loaded: {loadError}</p>
          <button
            className="asset-button asset-button--primary"
            onClick={() => setLoadAttempt((value) => value + 1)}
            type="button"
          >
            Try Again
          </button>
        </div>
      ) : null}
      {portrait ? (
        <div className="battle-overlay orientation-overlay" role="status">
          <p>Rotate your device to landscape to play.</p>
        </div>
      ) : null}
      {ready && hud?.paused && !portrait && !exitDialog ? (
        <div
          className="battle-overlay pause-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Game paused"
          onKeyDown={handleDialogKeyDown}
        >
          <h2>Paused</h2>
          <p>Time and combat are stopped.</p>
          <button
            className="asset-button asset-button--primary"
            onClick={togglePause}
            ref={resumeButtonRef}
            type="button"
          >
            Resume
          </button>
          <button
            className="asset-button asset-button--secondary"
            onClick={() => setExitDialog(true)}
            type="button"
          >
            Main Menu
          </button>
        </div>
      ) : null}
      {exitDialog ? (
        <div
          className="battle-overlay pause-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Leave game"
          onKeyDown={handleDialogKeyDown}
        >
          <h2>Leave this game?</h2>
          <p>This match will be abandoned and will not be recorded.</p>
          <div className="dialog-actions">
            <button
              className="asset-button asset-button--secondary"
              onClick={() => setExitDialog(false)}
              ref={exitCancelRef}
              type="button"
            >
              Keep Playing
            </button>
            <button
              className="asset-button asset-button--primary"
              onClick={onExit}
              type="button"
            >
              Leave Game
            </button>
          </div>
        </div>
      ) : null}
      <div
        className="touch-controls"
        aria-label="Touch controls"
        inert={Boolean(hud?.paused || exitDialog || portrait || !ready)}
      >
        {TOUCH_CONTROLS.map(({ action, label, icon }) => (
          <button
            aria-label={label}
            className={`touch-control touch-control--${action}`}
            key={action}
            onPointerCancel={handleTouchUp}
            onPointerDown={(event) => handleTouchDown(event, action)}
            onPointerLeave={handleTouchUp}
            onPointerUp={handleTouchUp}
            type="button"
          >
            <span aria-hidden="true">{icon}</span>
          </button>
        ))}
      </div>
      <p className="battle-help">
        W/↑ forward · A/D or ←/→ turn · Space front cannon · Q/E broadsides ·
        Esc pause
      </p>
      <p className="sr-only" aria-live="off">
        {hud?.paused ? "Game paused" : ready ? "Game running" : "Game loading"}.
        Score {hud?.score ?? 0}. Time remaining {remaining} seconds.
      </p>
    </section>
  );

  function togglePauseIfRunning() {
    const simulation = simulationRef.current;
    if (!simulation || simulation.paused) return;
    simulation.setPaused(true);
    inputRef.current?.clear();
    setHud(simulation.snapshot());
  }
}

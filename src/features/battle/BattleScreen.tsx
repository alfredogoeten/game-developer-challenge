import { Application } from "pixi.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { createGameBalance } from "./gameBalance";
import type { GameOptions } from "../options/gameOptions";
import { loadBattleTextures } from "./assets";
import { BattleRenderer } from "./BattleRenderer";
import { GameSimulation } from "./GameSimulation";
import type { Action, BattleHudSnapshot, GameSnapshot } from "./model";
import { InputController } from "./InputController";
import type { BattleTestBridge } from "./testBridge";

type BattleScreenProps = {
  options: GameOptions;
  onFinish: (snapshot: GameSnapshot) => void;
  onExit: () => void;
  onOpenOptions: () => void;
};

const TOUCH_CONTROLS: { action: Action; label: string; icon: string }[] = [
  { action: "turnLeft", label: "Turn left", icon: "turn-left" },
  { action: "forward", label: "Move forward", icon: "forward" },
  { action: "turnRight", label: "Turn right", icon: "turn-right" },
  { action: "port", label: "Fire left broadside", icon: "fire-left" },
  { action: "front", label: "Fire front cannon", icon: "fire-front" },
  { action: "starboard", label: "Fire right broadside", icon: "fire-right" },
];

function isPortraitMobile() {
  return window.matchMedia("(pointer: coarse) and (orientation: portrait)")
    .matches;
}

export function BattleScreen({ options, onFinish, onExit, onOpenOptions }: BattleScreenProps) {
  const balance = useMemo(() => createGameBalance(options), [options]);
  const mountRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<GameSimulation | null>(null);
  const inputRef = useRef<InputController | null>(null);
  const onFinishRef = useRef(onFinish);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [progress, setProgress] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [ready, setReady] = useState(false);
  const [hud, setHud] = useState<BattleHudSnapshot | null>(null);
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
    let renderer: BattleRenderer | null = null;
    const profiling = new URLSearchParams(location.search).has("profile");
    const frameTimes: number[] = [];
    let simulationTimeMs = 0;
    let rendererTimeMs = 0;
    let maxEntities = 0;
    let canvasCountAtLastFrame = 0;
    if (profiling) {
      window.__pirateBattleProfileStatus = {
        activeBattleInstances: 1,
        activeInputControllers: 0,
        activeTickers: 0,
      };
    }
    const simulation = new GameSimulation(
      balance,
      import.meta.env.DEV && new URLSearchParams(location.search).has("e2e")
        ? 12345
        : Date.now(),
    );
    simulationRef.current = simulation;
    if (profiling) simulation.setProfileInvulnerable(true);
    if (isPortraitMobile()) simulation.setPaused(true);

    const publish = (force = false) => {
      if (disposed) return;
      const now = performance.now();
      if (force || now - lastHudUpdate >= 100) {
        setHud(simulation.hudSnapshot());
        lastHudUpdate = now;
      }
    };

    const finishIfEnded = () => {
      if (!simulation.ended || disposed) return;
      input?.clear();
      publish(true);
      onFinishRef.current(simulation.snapshot());
    };
    const recordFrame = (frameMs: number) => {
      if (!profiling || frameMs <= 0 || frameMs > 250) return;
      frameTimes.push(frameMs);
      maxEntities = Math.max(
        maxEntities,
        1 + simulation.enemies.length + simulation.projectiles.length + simulation.effects.length,
      );
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
          app.destroy({ removeView: true }, { children: true, context: true });
          return;
        }
        renderer = new BattleRenderer(app, textures, balance);
        mountRef.current?.appendChild(app.canvas);
        renderer.render(simulation.renderState());
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
        if (profiling && window.__pirateBattleProfileStatus)
          window.__pirateBattleProfileStatus.activeInputControllers = 1;
        if (profiling) {
          window.__pirateBattleProfile = {
            snapshot: () => {
              const sorted = [...frameTimes].sort((left, right) => left - right);
              const total = frameTimes.reduce((sum, value) => sum + value, 0);
              return {
                frameCount: frameTimes.length,
                meanFrameMs: frameTimes.length ? total / frameTimes.length : 0,
                p95FrameMs: sorted.length
                  ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]
                  : 0,
                maxEntities,
                simulationMeanMs: frameTimes.length
                  ? simulationTimeMs / frameTimes.length
                  : 0,
                rendererMeanMs: frameTimes.length ? rendererTimeMs / frameTimes.length : 0,
                activeDurationSeconds: simulation.elapsed,
                endReason: simulation.ended,
                activeCanvasCount: canvasCountAtLastFrame,
              };
            },
          };
        }
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
              renderer?.render(simulation.renderState());
              app.render();
              publish(true);
              finishIfEnded();
            },
            spawn: (kind, x, y) => {
              simulation.debugSpawn(kind, x, y);
              renderer?.render(simulation.renderState());
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
          if (profiling && window.__pirateBattleProfileStatus)
            window.__pirateBattleProfileStatus.activeTickers = 1;
          app.ticker.add((ticker) => {
            recordFrame(ticker.deltaMS);
            if (simulation.paused || simulation.ended) {
              accumulator = 0;
              publish();
              return;
            }
            accumulator = Math.min(accumulator + ticker.deltaMS / 1000, 0.25);
            let iterations = 0;
            const simulationStart = performance.now();
            while (accumulator >= 1 / 60 && iterations < 8) {
              simulation.step(1 / 60, input?.getActions() ?? new Set<Action>());
              accumulator -= 1 / 60;
              iterations += 1;
              if (simulation.ended) break;
            }
            simulationTimeMs += performance.now() - simulationStart;
            const rendererStart = performance.now();
            renderer?.render(simulation.renderState());
            rendererTimeMs += performance.now() - rendererStart;
            canvasCountAtLastFrame = document.querySelectorAll(".battle-stage canvas").length;
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
      if (!profiling) delete window.__pirateBattleProfile;
      if (profiling)
        window.__pirateBattleProfileStatus = {
          activeBattleInstances: 0,
          activeInputControllers: 0,
          activeTickers: 0,
        };
      renderer?.destroy();
      if (applicationReady)
        application?.destroy(
          { removeView: true },
          { children: true, context: true },
        );
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
        if (simulationRef.current) setHud(simulationRef.current.hudSnapshot());
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
    setHud(simulation.hudSnapshot());
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
  const health = hud?.playerHealth ?? balance.player.health;
  const healthRatio = Math.max(0, Math.min(1, health / balance.player.health));
  const healthState = healthRatio > 0.5 ? "green" : healthRatio > 0.25 ? "amber" : "red";
  return (
    <section className="battle-screen" aria-label="Pirate Battle game">
      <header
        className="battle-hud"
        inert={Boolean(hud?.paused || exitDialog || portrait || !ready)}
      >
        <div className="hud-health" aria-label={`Health: ${health} of ${balance.player.health}`}>
          <span aria-hidden="true" className="hud-health__heart" />
          <span className={`hud-health__bar hud-health__bar--${healthState}`}>
            <span className="hud-health__fill" style={{ "--health-ratio": healthRatio } as React.CSSProperties} />
          </span>
          <span className="hud-health__value"><span data-testid="health">{health}</span> / {balance.player.health}</span>
        </div>
        <div className="hud-actions">
          <div className="hud-counters">
            <strong className="hud-counter hud-counter--score" aria-label={`Score: ${hud?.score ?? 0}`}><span data-testid="score">{hud?.score ?? 0}</span></strong>
            <strong className="hud-counter hud-counter--time" aria-label={`Time: ${remaining} seconds`}><span data-testid="time">{remaining}</span></strong>
          </div>
          <button
            aria-label={hud?.paused ? "Resume game" : "Pause game"}
            className="hud-round-button hud-round-button--pause"
            disabled={!ready || portrait}
            onClick={togglePause}
            type="button"
          >
            <span aria-hidden="true" className="hud-round-button__icon hud-round-button__icon--pause" />
          </button>
        </div>
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
          <div className="game-modal-panel">
            <h2>Paused</h2>
            <p>Ready when you are.</p>
            <button
            className="asset-button asset-button--primary"
            onClick={togglePause}
            ref={resumeButtonRef}
            type="button"
          >
            Resume
          </button>
          <button
            className="asset-button asset-button--primary"
            onClick={onOpenOptions}
            type="button"
          >
            Options
          </button>
          <button
            className="asset-button asset-button--primary"
            onClick={() => setExitDialog(true)}
            type="button"
          >
            Main Menu
          </button>
          </div>
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
          <div className="game-modal-panel">
            <h2>Leave this game?</h2>
            <p>This match will be abandoned and will not be recorded.</p>
            <div className="dialog-actions">
            <button
              className="asset-button asset-button--primary"
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
            <span aria-hidden="true" className={`touch-control__icon touch-control__icon--${icon}`} />
          </button>
        ))}
      </div>
      <p className="battle-help">
        W forward · A/D turn · Space front cannon · Q/E broadsides ·
        Esc pause
      </p>
      <p className="sr-only" aria-live="off">
        {hud?.paused ? "Game paused" : ready ? "Game running" : "Game loading"}.
        Score {hud?.score ?? 0}. Time remaining {remaining} seconds.
      </p>
    </section>
  );
}

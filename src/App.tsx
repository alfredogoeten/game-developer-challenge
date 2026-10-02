import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { GameOptions } from "./features/options/gameOptions";
import { loadGameOptions } from "./features/options/gameOptionsStorage";
import { OptionsScreen } from "./features/options/OptionsScreen";
import { createGameBalance } from "./features/battle/gameBalance";
import { BattleScreen } from "./features/battle/BattleScreen";
import type { GameSnapshot } from "./features/battle/model";
import {
  loadLocalMatches,
  confirmMatch,
  storeCompletedMatch,
} from "./features/matches/matchStorage";
import { registerMatch } from "./features/matches/api";
import type { MatchRecord } from "./features/matches/model";
import { ResultScreen } from "./features/matches/ResultScreen";
import { MainMenu } from "./features/menu/MainMenu";
import { RecordsScreen } from "./features/menu/RecordsScreen";
import {
  loadScenario,
  saveScenario,
  type Scenario,
} from "./mocks/scenarios";
import { resetConfirmedMatches } from "./mocks/store";

type Screen = "menu" | "options" | "ranking" | "history" | "battle" | "result";

function App() {
  const queryClient = useQueryClient();
  const [screen, setScreen] = useState<Screen>("menu");
  const [gameOptions, setGameOptions] = useState<GameOptions>(loadGameOptions);
  const [battleOptions, setBattleOptions] = useState<GameOptions>(gameOptions);
  const [localMatches, setLocalMatches] = useState(loadLocalMatches);
  const localMatchesRef = useRef(localMatches);
  const [activeScenario, setActiveScenario] = useState<Scenario>(loadScenario);
  const [scenarioEpoch, setScenarioEpoch] = useState(0);
  const [syncRound, setSyncRound] = useState(0);
  const attemptedRef = useRef(new Set<string>());
  const syncingRef = useRef(false);
  const [result, setResult] = useState<MatchRecord | null>(null);
  const [resultSaved, setResultSaved] = useState(true);
  const [battleKey, setBattleKey] = useState("");
  const matchIdRef = useRef("");
  const finishedMatchIdRef = useRef("");
  const [statusMessage, setStatusMessage] = useState("");
  const optionsButtonRef = useRef<HTMLButtonElement>(null);
  const rankingButtonRef = useRef<HTMLButtonElement>(null);
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const { mutateAsync: sendMatch, isPending: isSyncing } = useMutation({ mutationFn: registerMatch, retry: false });

  const updateLocalMatches = useCallback((state: typeof localMatches) => {
    localMatchesRef.current = state;
    setLocalMatches(state);
  }, []);

  useEffect(() => {
    if (syncingRef.current || !resultSaved) return;
    const match = localMatches.pending.find((item) => !attemptedRef.current.has(item.matchId));
    if (!match) return;
    attemptedRef.current.add(match.matchId);
    syncingRef.current = true;
    void sendMatch(match).then(async () => {
      const saved = confirmMatch(localMatchesRef.current, match.matchId);
      if (saved.saved) {
        updateLocalMatches(saved.state);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["ranking"] }),
          queryClient.invalidateQueries({ queryKey: ["history"] }),
        ]);
      }
    }).catch(() => {
      // Keep the record pending until a manual retry, reload, or scenario recovery.
    }).finally(() => {
      syncingRef.current = false;
      setSyncRound((round) => round + 1);
    });
  }, [localMatches.pending, resultSaved, syncRound, sendMatch, queryClient, updateLocalMatches]);

  useEffect(() => {
    const retryOnReconnect = () => retryPending();
    window.addEventListener("online", retryOnReconnect);
    return () => window.removeEventListener("online", retryOnReconnect);
  }, []);

  function retryPending() {
    attemptedRef.current.clear();
    setSyncRound((round) => round + 1);
  }

  function changeScenario(scenario: Scenario) {
    if (scenario === activeScenario) return;
    saveScenario(scenario);
    void queryClient.cancelQueries({ queryKey: ["ranking"] });
    void queryClient.cancelQueries({ queryKey: ["history"] });
    setActiveScenario(scenario);
    setScenarioEpoch((epoch) => epoch + 1);
    setStatusMessage(`Network scenario changed to ${scenario.replaceAll("-", " ")}.`);
  }

  function resetDemoData() {
    resetConfirmedMatches();
    saveScenario("success");
    void queryClient.cancelQueries({ queryKey: ["ranking"] });
    void queryClient.cancelQueries({ queryKey: ["history"] });
    queryClient.removeQueries({ queryKey: ["ranking"] });
    queryClient.removeQueries({ queryKey: ["history"] });
    setActiveScenario("success");
    setScenarioEpoch((epoch) => epoch + 1);
    setStatusMessage("Mock data reset. Local options and match results were kept.");
  }

  function openOptions() {
    setStatusMessage("");
    setScreen("options");
  }

  function returnToMenu(
    message = "",
    focus: "options" | "ranking" | "history" = "options",
  ) {
    setStatusMessage(message);
    setScreen("menu");
    window.requestAnimationFrame(() => {
      const target = {
        options: optionsButtonRef,
        ranking: rankingButtonRef,
        history: historyButtonRef,
      }[focus];
      target.current?.focus();
    });
  }

  function handleOptionsChange(options: GameOptions) {
    setGameOptions(options);
  }

  function startGame() {
    const touchDevice = navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches;
    const automatedRun = import.meta.env.DEV && new URLSearchParams(location.search).has("e2e");
    if (touchDevice && !automatedRun && !document.fullscreenElement) {
      void document.documentElement.requestFullscreen?.().catch(() => {
        // Some mobile browsers do not allow the Fullscreen API.
      });
    }
    setBattleOptions({ ...gameOptions });
    matchIdRef.current = crypto.randomUUID();
    setBattleKey(matchIdRef.current);
    finishedMatchIdRef.current = "";
    setResult(null);
    setScreen("battle");
  }

  function finishGame(snapshot: GameSnapshot) {
    if (!snapshot.ended || finishedMatchIdRef.current === matchIdRef.current)
      return;
    finishedMatchIdRef.current = matchIdRef.current;
    const record: MatchRecord = {
      matchId: matchIdRef.current,
      playerId: localMatchesRef.current.playerId,
      completedAt: new Date().toISOString(),
      score: snapshot.score,
      durationSeconds: Math.round(snapshot.elapsed * 100) / 100,
      endReason: snapshot.ended,
      options: { ...battleOptions },
      balance: createGameBalance(battleOptions),
    };
    const saved = storeCompletedMatch(localMatchesRef.current, record);
    updateLocalMatches(saved.state);
    setResultSaved(saved.saved);
    setResult(record);
    setScreen("result");
  }

  function retryResultSave() {
    if (!result) return;
    const saved = storeCompletedMatch(localMatchesRef.current, result);
    updateLocalMatches(saved.state);
    setResultSaved(saved.saved);
  }

  return (
    <main className="app-shell">
      {screen === "menu" ? (
        <MainMenu
          pendingCount={localMatches.pending.length}
          onRetryPending={retryPending}
          syncing={isSyncing}
          hasLastResult={localMatches.lastCompleted !== null}
          onOpenLastResult={() => {
            setResult(localMatches.lastCompleted);
            setResultSaved(true);
            setScreen("result");
          }}
          onOpenOptions={openOptions}
          onOpenRanking={() => setScreen("ranking")}
          onOpenHistory={() => setScreen("history")}
          onPlay={startGame}
          optionsButtonRef={optionsButtonRef}
          rankingButtonRef={rankingButtonRef}
          historyButtonRef={historyButtonRef}
          statusMessage={statusMessage}
          activeScenario={activeScenario}
          onScenarioChange={changeScenario}
          onResetDemoData={resetDemoData}
        />
      ) : screen === "options" ? (
        <OptionsScreen
          initialOptions={gameOptions}
          onReturnToMenu={() => returnToMenu()}
          onChange={handleOptionsChange}
        />
      ) : screen === "ranking" ? (
        <RecordsScreen
          key="ranking"
          kind="ranking"
          options={gameOptions}
          playerId={localMatches.playerId}
          scenarioEpoch={scenarioEpoch}
          onReturnToMenu={() => returnToMenu("", "ranking")}
          onOpenRanking={() => setScreen("ranking")}
          onOpenHistory={() => setScreen("history")}
        />
      ) : screen === "history" ? (
        <RecordsScreen
          key="history"
          kind="history"
          options={gameOptions}
          playerId={localMatches.playerId}
          scenarioEpoch={scenarioEpoch}
          onReturnToMenu={() => returnToMenu("", "history")}
          onOpenRanking={() => setScreen("ranking")}
          onOpenHistory={() => setScreen("history")}
        />
      ) : screen === "battle" ? (
        <BattleScreen
          key={battleKey}
          onExit={() => setScreen("menu")}
          onOpenOptions={openOptions}
          onFinish={finishGame}
          options={battleOptions}
        />
      ) : result ? (
        <ResultScreen
          onMainMenu={() => setScreen("menu")}
          onPlayAgain={startGame}
          onRetrySave={retryResultSave}
          onRetrySync={retryPending}
          record={result}
          saved={resultSaved}
          pending={localMatches.pending.some((item) => item.matchId === result.matchId)}
          syncing={isSyncing}
        />
      ) : null}
    </main>
  );
}

export default App;

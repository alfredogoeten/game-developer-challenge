import { useRef, useState } from "react";
import type { GameOptions } from "./features/options/gameOptions";
import { loadGameOptions } from "./features/options/gameOptionsStorage";
import { OptionsScreen } from "./features/options/OptionsScreen";
import { createGameBalance } from "./features/battle/gameBalance";
import { BattleScreen } from "./features/battle/BattleScreen";
import type { GameSnapshot } from "./features/battle/model";
import {
  loadLocalMatches,
  storeCompletedMatch,
} from "./features/matches/matchStorage";
import type { MatchRecord } from "./features/matches/model";
import { ResultScreen } from "./features/matches/ResultScreen";
import { MainMenu } from "./features/menu/MainMenu";

type Screen = "menu" | "options" | "battle" | "result";

function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [gameOptions, setGameOptions] = useState<GameOptions>(loadGameOptions);
  const [battleOptions, setBattleOptions] = useState<GameOptions>(gameOptions);
  const [localMatches, setLocalMatches] = useState(loadLocalMatches);
  const [result, setResult] = useState<MatchRecord | null>(null);
  const [resultSaved, setResultSaved] = useState(true);
  const [battleKey, setBattleKey] = useState("");
  const matchIdRef = useRef("");
  const finishedMatchIdRef = useRef("");
  const [statusMessage, setStatusMessage] = useState("");
  const optionsButtonRef = useRef<HTMLButtonElement>(null);

  function openOptions() {
    setStatusMessage("");
    setScreen("options");
  }

  function returnToMenu(message = "") {
    setStatusMessage(message);
    setScreen("menu");
    window.requestAnimationFrame(() => optionsButtonRef.current?.focus());
  }

  function handleSave(options: GameOptions) {
    setGameOptions(options);
    returnToMenu("Options saved.");
  }

  function startGame() {
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
      playerId: localMatches.playerId,
      completedAt: new Date().toISOString(),
      score: snapshot.score,
      durationSeconds: Math.round(snapshot.elapsed * 100) / 100,
      endReason: snapshot.ended,
      options: { ...battleOptions },
      balance: createGameBalance(battleOptions),
    };
    const saved = storeCompletedMatch(localMatches, record);
    setLocalMatches(saved.state);
    setResultSaved(saved.saved);
    setResult(record);
    setScreen("result");
  }

  function retryResultSave() {
    if (!result) return;
    const saved = storeCompletedMatch(localMatches, result);
    setLocalMatches(saved.state);
    setResultSaved(saved.saved);
  }

  return (
    <main className="app-shell">
      {screen === "menu" ? (
        <MainMenu
          hasLastResult={localMatches.lastCompleted !== null}
          onOpenLastResult={() => {
            setResult(localMatches.lastCompleted);
            setResultSaved(true);
            setScreen("result");
          }}
          onOpenOptions={openOptions}
          onPlay={startGame}
          optionsButtonRef={optionsButtonRef}
          statusMessage={statusMessage}
        />
      ) : screen === "options" ? (
        <OptionsScreen
          initialOptions={gameOptions}
          onReturnToMenu={() => returnToMenu()}
          onSave={handleSave}
        />
      ) : screen === "battle" ? (
        <BattleScreen
          key={battleKey}
          onExit={() => setScreen("menu")}
          onFinish={finishGame}
          options={battleOptions}
        />
      ) : result ? (
        <ResultScreen
          onMainMenu={() => setScreen("menu")}
          onPlayAgain={startGame}
          onRetrySave={retryResultSave}
          record={result}
          saved={resultSaved}
        />
      ) : null}
    </main>
  );
}

export default App;

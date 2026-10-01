import type { EnemyKind, GameSnapshot } from "./model";

export type BattleTestBridge = {
  snapshot: () => GameSnapshot;
  step: (ticks: number) => void;
  spawn: (kind: EnemyKind, x: number, y: number) => void;
  setElapsed: (seconds: number) => void;
};

declare global {
  interface Window {
    __pirateBattleTest?: BattleTestBridge;
    __allowMatchSave?: () => void;
  }
}

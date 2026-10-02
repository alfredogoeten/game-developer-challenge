import type { EnemyKind, GameSnapshot } from "./model";

export type BattleTestBridge = {
  snapshot: () => GameSnapshot;
  step: (ticks: number) => void;
  spawn: (kind: EnemyKind, x: number, y: number) => void;
  setElapsed: (seconds: number) => void;
};

export type BattleProfile = {
  snapshot: () => {
    frameCount: number;
    meanFrameMs: number;
    p95FrameMs: number;
    maxEntities: number;
  };
};

declare global {
  interface Window {
    __pirateBattleTest?: BattleTestBridge;
    __allowMatchSave?: () => void;
    __pirateBattleFailAssetAttempts?: number;
    __pirateBattleProfile?: BattleProfile;
  }
}

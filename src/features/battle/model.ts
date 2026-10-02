export type Action =
  | "forward"
  | "turnLeft"
  | "turnRight"
  | "front"
  | "port"
  | "starboard";
export type EnemyKind = "chaser" | "shooter";
export type EndReason = "time" | "death";
export type Ship = {
  id: number;
  x: number;
  y: number;
  angle: number;
  health: number;
  maxHealth: number;
  radius: number;
  hitFeedback: number;
};
export type Enemy = Ship & {
  kind: EnemyKind;
  fireCooldown: number;
  avoidanceIsland: number;
  avoidanceSide: -1 | 0 | 1;
  stuckTime: number;
  escapeTime: number;
};
export type Projectile = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifetime: number;
  owner: "player" | "enemy";
};
export type Effect = {
  id: number;
  x: number;
  y: number;
  kind: "muzzle" | "impact" | "explosion";
  age: number;
  duration: number;
};
export type GameSnapshot = {
  player: Ship;
  enemies: Enemy[];
  projectiles: Projectile[];
  effects: Effect[];
  score: number;
  elapsed: number;
  remaining: number;
  paused: boolean;
  ended: EndReason | null;
  spawnCount: number;
};

/** Mutable state consumed by PixiJS once per animation frame. */
export type BattleRenderState = Readonly<{
  player: Ship;
  enemies: readonly Enemy[];
  projectiles: readonly Projectile[];
  effects: readonly Effect[];
}>;

/** Small immutable sample published to React at a bounded rate. */
export type BattleHudSnapshot = Readonly<{
  playerHealth: number;
  playerMaxHealth: number;
  score: number;
  remaining: number;
  paused: boolean;
  ended: EndReason | null;
}>;

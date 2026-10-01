import type { GameOptions } from "../options/gameOptions";

export type IslandLobe = { x: number; y: number; radius: number };
export type IslandShape = {
  x: number;
  y: number;
  lobes: readonly IslandLobe[];
};

export type GameBalance = Readonly<{
  arena: { width: number; height: number };
  islands: readonly IslandShape[];
  player: {
    x: number;
    y: number;
    health: number;
    radius: number;
    speed: number;
    turnSpeed: number;
  };
  chaser: {
    health: number;
    radius: number;
    speed: number;
    turnSpeed: number;
    impactDamage: number;
  };
  shooter: {
    health: number;
    radius: number;
    speed: number;
    turnSpeed: number;
    attackRange: number;
    preferredRange: number;
    fireCooldown: number;
    projectileSpeed: number;
  };
  projectile: {
    radius: number;
    speed: number;
    lifetime: number;
    damage: number;
  };
  weapons: { frontCooldown: number; broadsideCooldown: number };
  spawn: {
    interval: number;
    minimumPlayerDistance: number;
    points: readonly { x: number; y: number }[];
  };
  duration: number;
}>;

export const BATTLE_BALANCE = {
  arena: { width: 960, height: 540 },
  islands: [
    {
      x: 390,
      y: 225,
      lobes: [
        { x: -35, y: 18, radius: 48 },
        { x: 15, y: -28, radius: 44 },
        { x: 48, y: 20, radius: 35 },
      ],
    },
    {
      x: 690,
      y: 360,
      lobes: [
        { x: -40, y: -22, radius: 40 },
        { x: 12, y: 17, radius: 48 },
        { x: 48, y: -23, radius: 33 },
      ],
    },
  ],
  player: {
    x: 188,
    y: 270,
    health: 5,
    radius: 22,
    speed: 150,
    turnSpeed: Math.PI,
  },
  chaser: {
    health: 2,
    radius: 21,
    speed: 86,
    turnSpeed: 2.6,
    impactDamage: 1,
  },
  shooter: {
    health: 1,
    radius: 21,
    speed: 68,
    turnSpeed: 2.2,
    attackRange: 310,
    preferredRange: 220,
    fireCooldown: 1.5,
    projectileSpeedMultiplier: 0.75,
  },
  projectile: { radius: 5, speed: 330, lifetime: 1.6, damage: 1 },
  weapons: { frontCooldown: 0.42, broadsideCooldown: 1.2 },
  spawn: {
    minimumPlayerDistance: 250,
    points: [
      { x: 70, y: 70 },
      { x: 280, y: 70 },
      { x: 680, y: 70 },
      { x: 890, y: 70 },
      { x: 70, y: 470 },
      { x: 280, y: 470 },
      { x: 680, y: 470 },
      { x: 890, y: 470 },
    ],
  },
} as const;

export const COMBAT_FEEDBACK = {
  hitDuration: 0.24,
  impactDuration: 0.24,
  explosionDuration: 0.48,
  muzzleDuration: 0.13,
} as const;

export function createGameBalance(options: GameOptions): GameBalance {
  const { projectileSpeedMultiplier, ...shooter } = BATTLE_BALANCE.shooter;
  return {
    arena: { ...BATTLE_BALANCE.arena },
    islands: BATTLE_BALANCE.islands,
    player: { ...BATTLE_BALANCE.player },
    chaser: { ...BATTLE_BALANCE.chaser },
    shooter: {
      ...shooter,
      projectileSpeed:
        BATTLE_BALANCE.projectile.speed *
        projectileSpeedMultiplier,
    },
    projectile: { ...BATTLE_BALANCE.projectile },
    weapons: { ...BATTLE_BALANCE.weapons },
    spawn: {
      interval: options.enemySpawnIntervalSeconds,
      minimumPlayerDistance: BATTLE_BALANCE.spawn.minimumPlayerDistance,
      points: BATTLE_BALANCE.spawn.points,
    },
    duration: options.sessionDurationSeconds,
  };
}

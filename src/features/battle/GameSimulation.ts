import type { GameBalance } from "./gameBalance";

import type {
  Action,
  Enemy,
  EnemyKind,
  Effect,
  EndReason,
  GameSnapshot,
  Projectile,
  Ship,
} from "./model";

const TAU = Math.PI * 2;

export class GameSimulation {
  readonly balance: GameBalance;
  readonly player: Ship;
  readonly enemies: Enemy[] = [];
  readonly projectiles: Projectile[] = [];
  readonly effects: Effect[] = [];
  score = 0;
  elapsed = 0;
  paused = false;
  ended: EndReason | null = null;
  spawnCount = 0;
  private spawnCooldown: number;
  private frontCooldown = 0;
  private portCooldown = 0;
  private starboardCooldown = 0;
  private nextId = 1;
  private randomState: number;
  private readonly islandLobes: { x: number; y: number; radius: number }[];
  private readonly islandNavigation: { x: number; y: number; radius: number }[];

  constructor(balance: GameBalance, seed = 2026) {
    this.balance = balance;
    this.player = {
      id: 0,
      x: balance.player.x,
      y: balance.player.y,
      angle: 0,
      health: balance.player.health,
      maxHealth: balance.player.health,
      radius: balance.player.radius,
      hitFeedback: 0,
    };
    this.islandLobes = balance.islands.flatMap((island) =>
      island.lobes.map((lobe) => ({
        x: island.x + lobe.x,
        y: island.y + lobe.y,
        radius: lobe.radius,
      })),
    );
    this.islandNavigation = balance.islands.map((island) => ({
      x: island.x,
      y: island.y,
      radius: Math.max(
        ...island.lobes.map((lobe) => Math.hypot(lobe.x, lobe.y) + lobe.radius),
      ),
    }));
    this.spawnCooldown = balance.spawn.interval;
    this.randomState = seed >>> 0 || 1;
  }

  snapshot(): GameSnapshot {
    return {
      player: { ...this.player },
      enemies: this.enemies.map((enemy) => ({ ...enemy })),
      projectiles: this.projectiles.map((projectile) => ({ ...projectile })),
      effects: this.effects.map((effect) => ({ ...effect })),
      score: this.score,
      elapsed: this.elapsed,
      remaining: Math.max(0, this.balance.duration - this.elapsed),
      paused: this.paused,
      ended: this.ended,
      spawnCount: this.spawnCount,
    };
  }

  setPaused(value: boolean) {
    if (!this.ended) this.paused = value;
  }

  step(dt: number, actions: ReadonlySet<Action>) {
    if (this.paused || this.ended || dt <= 0) return;
    const delta = Math.min(dt, 1 / 30);
    this.elapsed = Math.min(this.balance.duration, this.elapsed + delta);
    if (this.elapsed >= this.balance.duration) {
      this.ended = "time";
      return;
    }

    this.frontCooldown = Math.max(0, this.frontCooldown - delta);
    this.portCooldown = Math.max(0, this.portCooldown - delta);
    this.starboardCooldown = Math.max(0, this.starboardCooldown - delta);
    this.updatePlayer(delta, actions);
    this.updateEnemies(delta);
    this.updateProjectiles(delta);
    this.updateEffects(delta);
    if (this.ended) return;

    this.spawnCooldown -= delta;
    while (this.spawnCooldown <= 1e-9 && !this.ended) {
      this.spawnEnemy();
      this.spawnCooldown += this.balance.spawn.interval;
    }
  }

  private updatePlayer(dt: number, actions: ReadonlySet<Action>) {
    const turn =
      Number(actions.has("turnRight")) - Number(actions.has("turnLeft"));
    this.player.angle = normalizeAngle(
      this.player.angle + turn * this.balance.player.turnSpeed * dt,
    );
    if (actions.has("forward")) {
      this.moveShip(
        this.player,
        Math.cos(this.player.angle) * this.balance.player.speed * dt,
        Math.sin(this.player.angle) * this.balance.player.speed * dt,
      );
    }
    if (actions.has("front") && this.frontCooldown <= 0) {
      this.fire(
        this.player,
        this.player.angle,
        "player",
        [0],
        this.player.radius + 7,
      );
      this.frontCooldown = this.balance.weapons.frontCooldown;
    }
    if (actions.has("port") && this.portCooldown <= 0) {
      this.fire(
        this.player,
        this.player.angle - Math.PI / 2,
        "player",
        [-17, 0, 17],
        this.player.radius + 7,
      );
      this.portCooldown = this.balance.weapons.broadsideCooldown;
    }
    if (actions.has("starboard") && this.starboardCooldown <= 0) {
      this.fire(
        this.player,
        this.player.angle + Math.PI / 2,
        "player",
        [-17, 0, 17],
        this.player.radius + 7,
      );
      this.starboardCooldown = this.balance.weapons.broadsideCooldown;
    }
  }

  private updateEnemies(dt: number) {
    for (const enemy of [...this.enemies]) {
      const spec = this.balance[enemy.kind];
      const distance = Math.hypot(
        this.player.x - enemy.x,
        this.player.y - enemy.y,
      );
      const aim = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
      const shotBlocked = this.lineHitsIsland(
        enemy.x,
        enemy.y,
        this.player.x,
        this.player.y,
        this.balance.projectile.radius,
      );
      const desired =
        enemy.escapeTime > 0
          ? this.escapeBoundary(enemy)
          : this.avoidIsland(enemy, aim);
      enemy.escapeTime = Math.max(0, enemy.escapeTime - dt);
      enemy.angle = turnToward(enemy.angle, desired, spec.turnSpeed * dt);
      const shouldAdvance =
        enemy.kind === "chaser" ||
        distance > this.balance.shooter.preferredRange ||
        shotBlocked;
      if (shouldAdvance) {
        const previousX = enemy.x;
        const previousY = enemy.y;
        this.moveShip(
          enemy,
          Math.cos(enemy.angle) * spec.speed * dt,
          Math.sin(enemy.angle) * spec.speed * dt,
        );
        const moved = Math.hypot(enemy.x - previousX, enemy.y - previousY);
        enemy.stuckTime =
          moved < spec.speed * dt * 0.15
            ? enemy.stuckTime + dt
            : Math.max(0, enemy.stuckTime - dt * 2);
        if (enemy.stuckTime >= 0.45) {
          enemy.stuckTime = 0;
          if (this.nearBoundary(enemy)) enemy.escapeTime = 0.9;
          else enemy.avoidanceSide = enemy.avoidanceSide === 1 ? -1 : 1;
        }
      } else {
        enemy.stuckTime = 0;
      }

      if (enemy.kind === "shooter") {
        enemy.fireCooldown = Math.max(0, enemy.fireCooldown - dt);
        if (
          distance <= this.balance.shooter.attackRange &&
          !this.lineHitsIsland(
            enemy.x,
            enemy.y,
            this.player.x,
            this.player.y,
            this.balance.projectile.radius,
          ) &&
          enemy.fireCooldown <= 0
        ) {
          this.fire(enemy, aim, "enemy", [0], enemy.radius + 7);
          enemy.fireCooldown = this.balance.shooter.fireCooldown;
        }
      } else if (
        Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y) <=
        this.player.radius + enemy.radius
      ) {
        this.damagePlayer(this.balance.chaser.impactDamage);
        this.addEffect(enemy.x, enemy.y, "explosion", 0.48);
        this.enemies.splice(this.enemies.indexOf(enemy), 1);
      }
      if (this.ended) return;
    }
  }

  private updateProjectiles(dt: number) {
    for (const projectile of [...this.projectiles]) {
      const x = projectile.x + projectile.vx * dt;
      const y = projectile.y + projectile.vy * dt;
      projectile.lifetime -= dt;
      let hit =
        projectile.lifetime <= 0 ||
        x < 0 ||
        x > this.balance.arena.width ||
        y < 0 ||
        y > this.balance.arena.height;
      if (
        !hit &&
        this.lineHitsIsland(
          projectile.x,
          projectile.y,
          x,
          y,
          this.balance.projectile.radius,
        )
      ) {
        hit = true;
        this.addEffect(x, y, "impact", 0.24);
      }
      if (!hit && projectile.owner === "player") {
        for (const enemy of this.enemies) {
          if (
            !segmentHitsCircle(
              projectile.x,
              projectile.y,
              x,
              y,
              enemy.x,
              enemy.y,
              enemy.radius + this.balance.projectile.radius,
            )
          )
            continue;
          enemy.health -= this.balance.projectile.damage;
          enemy.hitFeedback = 0.24;
          hit = true;
          if (enemy.health <= 0) {
            this.enemies.splice(this.enemies.indexOf(enemy), 1);
            this.score += 1;
            this.addEffect(enemy.x, enemy.y, "explosion", 0.48);
          } else this.addEffect(x, y, "impact", 0.24);
          break;
        }
      } else if (
        !hit &&
        projectile.owner === "enemy" &&
        segmentHitsCircle(
          projectile.x,
          projectile.y,
          x,
          y,
          this.player.x,
          this.player.y,
          this.player.radius + this.balance.projectile.radius,
        )
      ) {
        this.damagePlayer(this.balance.projectile.damage);
        this.addEffect(x, y, "impact", 0.24);
        hit = true;
      }
      if (hit) this.projectiles.splice(this.projectiles.indexOf(projectile), 1);
      else {
        projectile.x = x;
        projectile.y = y;
      }
      if (this.ended) return;
    }
  }

  private updateEffects(dt: number) {
    this.player.hitFeedback = Math.max(0, this.player.hitFeedback - dt);
    for (const enemy of this.enemies)
      enemy.hitFeedback = Math.max(0, enemy.hitFeedback - dt);
    for (const effect of [...this.effects]) {
      effect.age += dt;
      if (effect.age >= effect.duration)
        this.effects.splice(this.effects.indexOf(effect), 1);
    }
  }

  private damagePlayer(amount: number) {
    this.player.health = Math.max(0, this.player.health - amount);
    this.player.hitFeedback = 0.24;
    if (this.player.health <= 0) this.ended = "death";
  }

  private fire(
    ship: Ship,
    angle: number,
    owner: "player" | "enemy",
    offsets: number[],
    distance: number,
  ) {
    for (const offset of offsets) {
      const x = ship.x + Math.cos(angle) * distance - Math.sin(angle) * offset;
      const y = ship.y + Math.sin(angle) * distance + Math.cos(angle) * offset;
      this.projectiles.push({
        id: this.nextId++,
        x,
        y,
        vx: Math.cos(angle) * this.balance.projectile.speed,
        vy: Math.sin(angle) * this.balance.projectile.speed,
        lifetime: this.balance.projectile.lifetime,
        owner,
      });
      this.addEffect(x, y, "muzzle", 0.13);
    }
  }

  private addEffect(
    x: number,
    y: number,
    kind: Effect["kind"],
    duration: number,
  ) {
    this.effects.push({ id: this.nextId++, x, y, kind, age: 0, duration });
  }

  private spawnEnemy() {
    const candidates = this.balance.spawn.points.filter(
      (point) =>
        Math.hypot(point.x - this.player.x, point.y - this.player.y) >=
          this.balance.spawn.minimumPlayerDistance &&
        this.islandLobes.every(
          (lobe) =>
            Math.hypot(point.x - lobe.x, point.y - lobe.y) >=
            lobe.radius + this.balance.chaser.radius + 10,
        ),
    );
    if (candidates.length === 0) return;
    const point = candidates[Math.floor(this.random() * candidates.length)];
    const kind: EnemyKind = this.spawnCount % 2 === 0 ? "chaser" : "shooter";
    const spec = this.balance[kind];
    this.enemies.push({
      id: this.nextId++,
      kind,
      x: point.x,
      y: point.y,
      angle: Math.atan2(this.player.y - point.y, this.player.x - point.x),
      health: spec.health,
      maxHealth: spec.health,
      radius: spec.radius,
      hitFeedback: 0,
      fireCooldown: this.balance.shooter.fireCooldown,
      avoidanceIsland: -1,
      avoidanceSide: 0,
      stuckTime: 0,
      escapeTime: 0,
    });
    this.spawnCount += 1;
  }

  private moveShip(ship: Ship, dx: number, dy: number) {
    const { width, height } = this.balance.arena;
    ship.x = Math.max(ship.radius, Math.min(width - ship.radius, ship.x + dx));
    ship.y = Math.max(ship.radius, Math.min(height - ship.radius, ship.y + dy));
    for (let pass = 0; pass < 3; pass += 1) {
      let corrected = false;
      for (const lobe of this.islandLobes) {
        const vx = ship.x - lobe.x;
        const vy = ship.y - lobe.y;
        const distance = Math.hypot(vx, vy);
        const limit = lobe.radius + ship.radius;
        if (distance >= limit) continue;
        const scale = limit / (distance || 1);
        ship.x = lobe.x + (distance ? vx * scale : limit);
        ship.y = lobe.y + vy * scale;
        corrected = true;
      }
      if (!corrected) break;
    }
    ship.x = Math.max(ship.radius, Math.min(width - ship.radius, ship.x));
    ship.y = Math.max(ship.radius, Math.min(height - ship.radius, ship.y));
  }

  private avoidIsland(ship: Enemy, directAngle: number) {
    let blockerIndex = -1;
    let nearestDistance = Infinity;
    this.islandNavigation.forEach((island, index) => {
      const distance = Math.hypot(ship.x - island.x, ship.y - island.y);
      if (
        distance < nearestDistance &&
        segmentHitsCircle(
          ship.x,
          ship.y,
          this.player.x,
          this.player.y,
          island.x,
          island.y,
          island.radius + ship.radius + 18,
        )
      ) {
        blockerIndex = index;
        nearestDistance = distance;
      }
    });
    if (blockerIndex < 0) {
      ship.avoidanceIsland = -1;
      ship.avoidanceSide = 0;
      return this.steerFromBoundary(ship, directAngle);
    }
    const blocker = this.islandNavigation[blockerIndex];
    const dx = ship.x - blocker.x;
    const dy = ship.y - blocker.y;
    const distance = Math.hypot(dx, dy) || 1;
    const radialX = dx / distance;
    const radialY = dy / distance;
    const cross =
      dx * (this.player.y - blocker.y) - dy * (this.player.x - blocker.x);
    if (ship.avoidanceIsland !== blockerIndex || ship.avoidanceSide === 0) {
      ship.avoidanceIsland = blockerIndex;
      ship.avoidanceSide = cross >= 0 ? 1 : -1;
    }
    const outside = Math.max(
      0,
      (blocker.radius + ship.radius + 28 - distance) / 35,
    );
    const routeAngle = (side: number) =>
      Math.atan2(
        radialX * side + radialY * outside,
        -radialY * side + radialX * outside,
      );
    const chosen = routeAngle(ship.avoidanceSide);
    const opposite = routeAngle(-ship.avoidanceSide);
    if (
      this.boundaryOverflow(ship, chosen) >
      this.boundaryOverflow(ship, opposite) + 8
    )
      ship.avoidanceSide = ship.avoidanceSide === 1 ? -1 : 1;
    return this.steerFromBoundary(ship, routeAngle(ship.avoidanceSide));
  }

  private boundaryOverflow(ship: Ship, angle: number) {
    const x = ship.x + Math.cos(angle) * 90;
    const y = ship.y + Math.sin(angle) * 90;
    const { width, height } = this.balance.arena;
    const inset = ship.radius + 8;
    return (
      Math.max(0, inset - x) +
      Math.max(0, x - width + inset) +
      Math.max(0, inset - y) +
      Math.max(0, y - height + inset)
    );
  }

  private steerFromBoundary(ship: Ship, angle: number) {
    const { width, height } = this.balance.arena;
    const margin = ship.radius + 70;
    let x = Math.cos(angle);
    let y = Math.sin(angle);
    if (x < 0) x += 2.4 * Math.max(0, (margin - ship.x) / margin);
    if (x > 0) x -= 2.4 * Math.max(0, (ship.x - width + margin) / margin);
    if (y < 0) y += 2.4 * Math.max(0, (margin - ship.y) / margin);
    if (y > 0) y -= 2.4 * Math.max(0, (ship.y - height + margin) / margin);
    return Math.atan2(y, x);
  }

  private nearBoundary(ship: Ship) {
    const { width, height } = this.balance.arena;
    return (
      ship.x <= ship.radius + 3 ||
      ship.x >= width - ship.radius - 3 ||
      ship.y <= ship.radius + 3 ||
      ship.y >= height - ship.radius - 3
    );
  }

  private escapeBoundary(ship: Ship) {
    const { width, height } = this.balance.arena;
    const inset = ship.radius + 105;
    const x = Math.max(inset, Math.min(width - inset, ship.x));
    const y = Math.max(inset, Math.min(height - inset, ship.y));
    return Math.atan2(y - ship.y, x - ship.x);
  }

  private lineHitsIsland(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    padding: number,
  ) {
    return this.islandLobes.some((lobe) =>
      segmentHitsCircle(x1, y1, x2, y2, lobe.x, lobe.y, lobe.radius + padding),
    );
  }

  private random() {
    this.randomState =
      (Math.imul(1664525, this.randomState) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }

  debugSpawn(kind: EnemyKind, x: number, y: number) {
    const spec = this.balance[kind];
    this.enemies.push({
      id: this.nextId++,
      kind,
      x,
      y,
      angle: Math.atan2(this.player.y - y, this.player.x - x),
      health: spec.health,
      maxHealth: spec.health,
      radius: spec.radius,
      hitFeedback: 0,
      fireCooldown: this.balance.shooter.fireCooldown,
      avoidanceIsland: -1,
      avoidanceSide: 0,
      stuckTime: 0,
      escapeTime: 0,
    });
  }
}

function normalizeAngle(angle: number) {
  return ((angle % TAU) + TAU) % TAU;
}
function turnToward(current: number, target: number, maxStep: number) {
  const difference = Math.atan2(
    Math.sin(target - current),
    Math.cos(target - current),
  );
  return normalizeAngle(
    current + Math.max(-maxStep, Math.min(maxStep, difference)),
  );
}
function segmentHitsCircle(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  radius: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared
    ? Math.max(
        0,
        Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / lengthSquared),
      )
    : 0;
  return Math.hypot(x1 + dx * t - cx, y1 + dy * t - cy) <= radius;
}

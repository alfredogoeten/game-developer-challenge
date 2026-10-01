import {
  Application,
  Container,
  Graphics,
  Sprite,
  type Texture,
} from "pixi.js";
import type { GameBalance } from "./gameBalance";
import type { Effect, Enemy, GameSnapshot, Ship } from "./model";
import type { BattleTextures } from "./assets";

type ShipView = { root: Container; sprite: Sprite; health: Graphics };

export class BattleRenderer {
  private readonly app: Application;
  private readonly textures: BattleTextures;
  private readonly ships = new Map<number, ShipView>();
  private readonly bullets = new Map<number, Sprite>();
  private readonly effects = new Map<number, Sprite>();
  private readonly shipLayer = new Container();
  private readonly bulletLayer = new Container();
  private readonly effectLayer = new Container();

  constructor(
    app: Application,
    textures: BattleTextures,
    balance: GameBalance,
  ) {
    this.app = app;
    this.textures = textures;
    const ocean = new Graphics()
      .rect(0, 0, balance.arena.width, balance.arena.height)
      .fill(0x146687);
    for (let y = 24; y < balance.arena.height; y += 48) {
      for (let x = (y % 96) * 3; x < balance.arena.width; x += 145) {
        ocean
          .moveTo(x, y)
          .quadraticCurveTo(x + 16, y - 6, x + 32, y)
          .stroke({ color: 0x6cbed0, alpha: 0.24, width: 2 });
      }
    }
    const islands = new Container();
    for (const [index, shape] of balance.islands.entries()) {
      const island = new Container();
      island.position.set(shape.x, shape.y);
      const shore = new Graphics();
      const sand = new Graphics();
      const vegetation = new Graphics();
      const detailMask = new Graphics();
      for (const lobe of shape.lobes) {
        shore.circle(lobe.x, lobe.y, lobe.radius + 8).fill(0x79c6b1);
        sand.circle(lobe.x, lobe.y, lobe.radius).fill(0xdcb679);
      }
      const foliage =
        index === 0
          ? [
              -58, 4, -44, -20, -15, -29, 4, -47, 33, -34, 41, -8, 55, 11, 32,
              29, -2, 35, -29, 34, -53, 21,
            ]
          : [
              -60, -23, -38, -37, -10, -30, 16, -42, 47, -27, 55, -4, 31, 17,
              15, 41, -20, 34, -43, 12, -61, 7,
            ];
      vegetation.poly(foliage).fill(0x72a553);
      detailMask.poly(foliage).fill(0xffffff);
      const landDetail = new Sprite(textures.island);
      landDetail.anchor.set(0.5);
      landDetail.width = 180;
      landDetail.height = 160;
      landDetail.alpha = 0.5;
      landDetail.mask = detailMask;
      island.addChild(shore, sand, vegetation, landDetail, detailMask);
      islands.addChild(island);
    }
    this.app.stage.addChild(
      ocean,
      islands,
      this.bulletLayer,
      this.shipLayer,
      this.effectLayer,
    );
  }

  render(snapshot: GameSnapshot) {
    this.syncShip(snapshot.player, this.textures.player);
    for (const enemy of snapshot.enemies)
      this.syncShip(enemy, this.textures[enemy.kind]);
    this.removeAbsent(
      this.ships,
      new Set([
        snapshot.player.id,
        ...snapshot.enemies.map((enemy) => enemy.id),
      ]),
    );

    for (const projectile of snapshot.projectiles) {
      let sprite = this.bullets.get(projectile.id);
      if (!sprite) {
        sprite = new Sprite(this.textures.projectile);
        sprite.anchor.set(0.5);
        sprite.scale.set(1.15);
        sprite.tint = projectile.owner === "player" ? 0xffdf8c : 0xff7777;
        this.bulletLayer.addChild(sprite);
        this.bullets.set(projectile.id, sprite);
      }
      sprite.position.set(projectile.x, projectile.y);
    }
    this.removeAbsent(
      this.bullets,
      new Set(snapshot.projectiles.map((item) => item.id)),
    );

    for (const effect of snapshot.effects) this.syncEffect(effect);
    this.removeAbsent(
      this.effects,
      new Set(snapshot.effects.map((item) => item.id)),
    );
  }

  private syncShip(ship: Ship | Enemy, texture: Texture) {
    let view = this.ships.get(ship.id);
    if (!view) {
      const root = new Container();
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.scale.set(ship.id === 0 ? 0.56 : 0.48);
      const health = new Graphics();
      root.addChild(sprite, health);
      this.shipLayer.addChild(root);
      view = { root, sprite, health };
      this.ships.set(ship.id, view);
    }
    view.root.position.set(ship.x, ship.y);
    view.sprite.rotation = ship.angle - Math.PI / 2;
    const ratio = ship.health / ship.maxHealth;
    const shake = ship.hitFeedback / 0.24;
    view.sprite.position.set(
      Math.sin(snapshotTime(ship.hitFeedback, ship.id)) * 3.5 * shake,
      Math.cos(snapshotTime(ship.hitFeedback, ship.id)) * 2 * shake,
    );
    view.sprite.tint =
      ship.hitFeedback > 0
        ? 0xffc2a7
        : ratio > 0.5
          ? 0xffffff
          : ratio > 0.25
            ? 0xffd49a
            : 0xff9292;
    view.health
      .clear()
      .roundRect(-25, -44, 50, 7, 2)
      .fill(0x102c3d)
      .roundRect(-23, -42, 46 * ratio, 3, 1)
      .fill(ratio > 0.5 ? 0x69d586 : ratio > 0.25 ? 0xf5bc57 : 0xf47773);
  }

  private syncEffect(effect: Effect) {
    let sprite = this.effects.get(effect.id);
    if (!sprite) {
      sprite = new Sprite(
        effect.kind === "explosion"
          ? this.textures.explosion
          : effect.kind === "impact"
            ? this.textures.impact
            : this.textures.flash,
      );
      sprite.anchor.set(0.5);
      this.effectLayer.addChild(sprite);
      this.effects.set(effect.id, sprite);
    }
    sprite.position.set(effect.x, effect.y);
    sprite.alpha = Math.max(0, 1 - effect.age / effect.duration);
    sprite.scale.set(
      effect.kind === "explosion"
        ? 0.55 + effect.age * 1.2
        : effect.kind === "impact"
          ? 0.36 + effect.age * 1.2
          : 0.25 + effect.age * 1.4,
    );
  }

  private removeAbsent<T extends Container>(
    items: Map<number, T | ShipView>,
    present: Set<number>,
  ) {
    for (const [id, view] of items) {
      if (present.has(id)) continue;
      const node = "root" in view ? view.root : view;
      node.parent?.removeChild(node);
      node.destroy({ children: true });
      items.delete(id);
    }
  }
}

function snapshotTime(remaining: number, id: number) {
  return (0.24 - remaining) * 105 + id * 1.7;
}

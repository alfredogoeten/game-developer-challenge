import {
  Application,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  TilingSprite,
  Texture,
} from "pixi.js";
import {
  COMBAT_FEEDBACK,
  ISLAND_LAND_HALF_SIZE,
  type GameBalance,
} from "./gameBalance";
import type { Effect, Enemy, GameSnapshot, Ship } from "./model";
import type { BattleTextures } from "./assets";

type ShipView = {
  root: Container;
  sprite: Sprite;
  healthFill: Sprite;
};

const ISLAND_TILES = [
  [6, 7, 8, 9],
  [22, 23, 24, 25],
  [38, 39, 40, 41],
  [54, 55, 56, 57],
] as const;

const TILE_SIZE = 64;
const TILES_PER_ROW = 16;

// These contours sit below the land tiles. Their deliberately uneven edges
// keep the shallow-water highlight from looking like a uniform outline.
const SHALLOW_WATER_CONTOURS = [
  {
    alpha: 0.1,
    points: [
      -25, 32, -13, 3, 27, -16, 66, -23, 105, -16, 139, -25, 180, -15,
      216, 5, 276, 29, 280, 68, 269, 100, 281, 138, 267, 176, 279, 216,
      250, 278, 213, 274, 181, 282, 143, 271, 104, 280, 67, 270, 29, 280,
      -20, 249, -14, 214, -25, 178, -16, 140, -26, 101, -15, 65,
    ],
  },
  {
    alpha: 0.13,
    points: [
      -16, 38, -7, 10, 32, -7, 68, -14, 106, -6, 140, -15, 177, -6,
      212, 13, 267, 37, 271, 69, 260, 101, 272, 137, 258, 174, 270, 211,
      243, 269, 210, 265, 179, 273, 142, 262, 105, 271, 70, 261, 33, 271,
      -11, 241, -5, 210, -16, 176, -7, 140, -17, 103, -6, 68,
    ],
  },
  {
    alpha: 0.16,
    points: [
      -8, 43, 1, 15, 37, 1, 70, -6, 108, 2, 141, -7, 174, 2, 207, 20,
      258, 43, 262, 70, 251, 102, 263, 136, 249, 171, 261, 207, 237, 260,
      207, 256, 177, 264, 142, 253, 106, 262, 72, 252, 38, 262, -3, 234,
      3, 207, -8, 174, 1, 140, -9, 105, 2, 71,
    ],
  },
] as const;

function islandTile(sheet: Texture, number: number): Texture {
  const index = number - 1;
  return new Texture({
    source: sheet.source,
    frame: new Rectangle(
      (index % TILES_PER_ROW) * TILE_SIZE,
      Math.floor(index / TILES_PER_ROW) * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE,
    ),
  });
}

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
    const ocean = new TilingSprite({
      texture: textures.ocean,
      width: balance.arena.width,
      height: balance.arena.height,
    });
    const islands = new Container();
    const tileCache = new Map<number, Texture>();
    const textureFor = (number: number) => {
      let texture = tileCache.get(number);
      if (!texture) {
        texture = islandTile(textures.islandTiles, number);
        tileCache.set(number, texture);
      }
      return texture;
    };
    for (const [index, shape] of balance.islands.entries()) {
      const island = new Container();
      island.pivot.set(ISLAND_LAND_HALF_SIZE, ISLAND_LAND_HALF_SIZE);
      island.position.set(shape.x, shape.y);
      island.rotation = index === 0 ? 0 : Math.PI;
      for (const contour of SHALLOW_WATER_CONTOURS) {
        const shallowWater = new Graphics();
        shallowWater.poly([...contour.points]).fill({
          color: 0xd7fff0,
          alpha: contour.alpha,
        });
        island.addChild(shallowWater);
      }
      for (const [row, numbers] of ISLAND_TILES.entries()) {
        for (const [column, number] of numbers.entries()) {
          const tile = new Sprite(textureFor(number));
          tile.position.set(column * TILE_SIZE, row * TILE_SIZE);
          island.addChild(tile);
        }
      }
      const decoration = index === 0
        ? [
            { tile: 71, x: 52, y: 161 },
            { tile: 66, x: 196, y: 108 },
          ]
        : [
            { tile: 70, x: 177, y: 77 },
            { tile: 72, x: 80, y: 182 },
            { tile: 65, x: 190, y: 185 },
          ];
      for (const item of decoration) {
        const sprite = new Sprite(textureFor(item.tile));
        sprite.position.set(item.x, item.y);
        island.addChild(sprite);
      }
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
      const healthFill = new Sprite(this.textures.shipHealthGreen);
      healthFill.anchor.set(0, 0.5);
      healthFill.position.set(-22, -36);
      healthFill.height = 9;
      const healthFrame = new Sprite(this.textures.shipHealthFrame);
      healthFrame.anchor.set(0.5);
      healthFrame.position.set(0, -36);
      healthFrame.width = 52;
      healthFrame.height = 15;
      root.addChild(sprite, healthFill, healthFrame);
      this.shipLayer.addChild(root);
      view = { root, sprite, healthFill };
      this.ships.set(ship.id, view);
    }
    view.root.position.set(ship.x, ship.y);
    view.sprite.rotation = ship.angle - Math.PI / 2;
    const ratio = ship.health / ship.maxHealth;
    const shake = ship.hitFeedback / COMBAT_FEEDBACK.hitDuration;
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
    view.healthFill.texture =
      ship.id === 0 && ratio > 0.25
        ? this.textures.shipHealthGreen
        : this.textures.shipHealthRed;
    view.healthFill.width = 44 * ratio;
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
  return (COMBAT_FEEDBACK.hitDuration - remaining) * 105 + id * 1.7;
}

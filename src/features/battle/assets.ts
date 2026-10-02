import { Assets, Texture } from "pixi.js";

const assetUrls = {
  player: new URL(
    "../../../assets/png/default/ships/ship_1.png",
    import.meta.url,
  ).href,
  chaser: new URL(
    "../../../assets/png/default/ships/ship_8.png",
    import.meta.url,
  ).href,
  shooter: new URL(
    "../../../assets/png/default/ships/ship_15.png",
    import.meta.url,
  ).href,
  projectile: new URL(
    "../../../assets/png/default/ship_parts/cannon_ball.png",
    import.meta.url,
  ).href,
  explosion: new URL(
    "../../../assets/png/default/effects/explosion_1.png",
    import.meta.url,
  ).href,
  impact: new URL(
    "../../../assets/png/default/effects/explosion_3.png",
    import.meta.url,
  ).href,
  flash: new URL(
    "../../../assets/png/default/effects/fire_1.png",
    import.meta.url,
  ).href,
  shipHealthFrame: new URL(
    "../../../assets/png/default/ui/hud/enemy_health_frame.png",
    import.meta.url,
  ).href,
  shipHealthGreen: new URL(
    "../../../assets/png/default/ui/hud/enemy_health_fill_green.png",
    import.meta.url,
  ).href,
  shipHealthRed: new URL(
    "../../../assets/png/default/ui/hud/enemy_health_fill_red.png",
    import.meta.url,
  ).href,
  islandTiles: new URL(
    "../../../assets/tilesheet/tiles_sheet.png",
    import.meta.url,
  ).href,
  ocean: new URL(
    "../../../assets/png/default/tiles/tile_73.png",
    import.meta.url,
  ).href,
} as const;

export type BattleTextures = Record<keyof typeof assetUrls, Texture>;

export async function loadBattleTextures(
  onProgress: (progress: number) => void,
): Promise<BattleTextures> {
  const entries = Object.entries(assetUrls) as [keyof BattleTextures, string][];
  const textures = {} as BattleTextures;
  let completed = 0;
  for (const [name, url] of entries) {
    if (import.meta.env.DEV && name === "player" && (window.__pirateBattleFailAssetAttempts ?? 0) > 0) {
      window.__pirateBattleFailAssetAttempts = (window.__pirateBattleFailAssetAttempts ?? 0) - 1;
      throw new Error("Simulated player texture failure.");
    }
    const texture = await Assets.load<Texture>(url);
    if (!texture || texture === Texture.EMPTY || !texture.source?.width)
      throw new Error(`Could not load ${name}.`);
    textures[name] = texture;
    completed += 1;
    onProgress(Math.round((completed / entries.length) * 100));
  }
  return textures;
}

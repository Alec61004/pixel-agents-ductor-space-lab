import { loadBrowserOfficeAssets } from '../browserMock.js';
import { setFloorSprites } from '../office/floorTiles.js';
import { buildDynamicCatalog } from '../office/layout/furnitureCatalog.js';
import { setCarpetSprites } from '../office/sprites/carpetTiles.js';
import { setCharacterTemplates } from '../office/sprites/spriteData.js';
import { setWallSprites } from '../office/wallTiles.js';

let ready: Promise<void> | null = null;

async function load(): Promise<void> {
  const assets = await loadBrowserOfficeAssets();
  setCharacterTemplates(assets.characters);
  setFloorSprites(assets.floorSprites);
  setWallSprites(assets.wallSets);
  setCarpetSprites(assets.carpetSets);
  if (
    !buildDynamicCatalog({ catalog: assets.furnitureCatalog, sprites: assets.furnitureSprites })
  ) {
    throw new Error('Ductor Space Lab assets are unavailable');
  }
}

export function loadDuctorOfficeAssets(): Promise<void> {
  ready ??= load();
  return ready;
}

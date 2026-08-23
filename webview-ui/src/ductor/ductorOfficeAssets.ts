import { loadBrowserOfficeAssets } from '../browserMock.js';
import { setFloorSprites } from '../office/floorTiles.js';
import { buildDynamicCatalog } from '../office/layout/furnitureCatalog.js';
import { setCarpetSprites } from '../office/sprites/carpetTiles.js';
import ductorSpaceLabTilesData from '../office/sprites/ductorSpaceLabTiles.json';
import { setCharacterTemplates } from '../office/sprites/spriteData.js';
import { setWallSprites } from '../office/wallTiles.js';

let ready: Promise<void> | null = null;

async function load(): Promise<void> {
  const assets = await loadBrowserOfficeAssets();
  setCharacterTemplates(assets.characters);
  setFloorSprites([
    ductorSpaceLabTilesData.floor as string[][],
    ...assets.floorSprites,
  ]);
  setWallSprites([
    ductorSpaceLabTilesData.wallSet as string[][][],
    ...assets.wallSets,
  ]);
  setCarpetSprites(assets.carpetSets);

  const catalog = [
    ...assets.furnitureCatalog,
    {
      id: 'WINDOW_GALAXY',
      label: 'Observation Window Galaxy',
      category: 'wall',
      width: 96,
      height: 32,
      footprintW: 6,
      footprintH: 2,
      isDesk: false,
      backgroundTiles: 2,
      canPlaceOnWalls: true,
    },
  ];
  const sprites = {
    ...assets.furnitureSprites,
    WINDOW_GALAXY: ductorSpaceLabTilesData.window as string[][],
  };

  if (
    !buildDynamicCatalog({ catalog, sprites })
  ) {
    throw new Error('Ductor Space Lab assets are unavailable');
  }
}

export function loadDuctorOfficeAssets(): Promise<void> {
  ready ??= load();
  return ready;
}

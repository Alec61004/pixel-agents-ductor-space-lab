import { loadBrowserOfficeAssets } from '../browserMock.js';
import { setFloorSprites } from '../office/floorTiles.js';
import { buildDynamicCatalog } from '../office/layout/furnitureCatalog.js';
import { setCarpetSprites } from '../office/sprites/carpetTiles.js';
import ductorCrewSpritesData from '../office/sprites/ductorCrewSprites.json';
import ductorSpaceLabTilesData from '../office/sprites/ductorSpaceLabTiles.json';
import type { LoadedCharacterData } from '../office/sprites/spriteData.js';
import { setCharacterTemplates } from '../office/sprites/spriteData.js';
import { setWallSprites } from '../office/wallTiles.js';

let ready: Promise<void> | null = null;

async function load(): Promise<void> {
  const assets = await loadBrowserOfficeAssets();
  const crewTemplates: LoadedCharacterData[] = [
    ductorCrewSpritesData.alec as unknown as LoadedCharacterData,
    ductorCrewSpritesData.kevin as unknown as LoadedCharacterData,
    ductorCrewSpritesData.benjamin as unknown as LoadedCharacterData,
  ];
  setCharacterTemplates(crewTemplates);
  setFloorSprites([ductorSpaceLabTilesData.floor as string[][], ...assets.floorSprites]);
  setWallSprites([ductorSpaceLabTilesData.wallSet as string[][][], ...assets.wallSets]);
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
    {
      id: 'CONSOLE_NEON',
      label: 'Neon Control Console',
      category: 'electronics',
      width: 48,
      height: 32,
      footprintW: 3,
      footprintH: 2,
      isDesk: true,
      backgroundTiles: 1,
    },
    {
      id: 'SPECIMEN_TANK',
      label: 'Specimen Containment Tank',
      category: 'decor',
      width: 32,
      height: 48,
      footprintW: 2,
      footprintH: 3,
      isDesk: false,
      backgroundTiles: 2,
    },
    {
      id: 'HOLO_TABLE',
      label: 'Hologram Star Map Table',
      category: 'decor',
      width: 32,
      height: 32,
      footprintW: 2,
      footprintH: 2,
      isDesk: false,
      backgroundTiles: 1,
    },
    {
      id: 'WEAPON_RACK',
      label: 'Wall Weapon Rack',
      category: 'wall',
      width: 32,
      height: 32,
      footprintW: 2,
      footprintH: 2,
      isDesk: false,
      backgroundTiles: 0,
      canPlaceOnWalls: true,
    },
  ];
  const sprites = {
    ...assets.furnitureSprites,
    WINDOW_GALAXY: ductorSpaceLabTilesData.window as string[][],
    CONSOLE_NEON: ductorSpaceLabTilesData.consoleNeon as string[][],
    SPECIMEN_TANK: ductorSpaceLabTilesData.specimenTank as string[][],
    HOLO_TABLE: ductorSpaceLabTilesData.holoTable as string[][],
    WEAPON_RACK: ductorSpaceLabTilesData.weaponRack as string[][],
  };

  if (!buildDynamicCatalog({ catalog, sprites })) {
    throw new Error('Ductor Space Lab assets are unavailable');
  }
}

export function loadDuctorOfficeAssets(): Promise<void> {
  ready ??= load();
  return ready;
}

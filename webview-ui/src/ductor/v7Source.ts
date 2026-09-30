import c00 from './v7-source/chunk-00.txt?raw';
import c01 from './v7-source/chunk-01.txt?raw';
import c02 from './v7-source/chunk-02.txt?raw';
import c03 from './v7-source/chunk-03.txt?raw';
import c04 from './v7-source/chunk-04.txt?raw';
import c05 from './v7-source/chunk-05.txt?raw';
import c06 from './v7-source/chunk-06.txt?raw';
import c07 from './v7-source/chunk-07.txt?raw';
import c08 from './v7-source/chunk-08.txt?raw';
import c09 from './v7-source/chunk-09.txt?raw';
import c10 from './v7-source/chunk-10.txt?raw';
import c11 from './v7-source/chunk-11.txt?raw';
import c12 from './v7-source/chunk-12.txt?raw';
import c13 from './v7-source/chunk-13.txt?raw';
import c14 from './v7-source/chunk-14.txt?raw';
import c15 from './v7-source/chunk-15.txt?raw';
import c16 from './v7-source/chunk-16.txt?raw';

import type { StarshipPixelSceneLayer, StarshipPixelSceneManifest } from './starshipPixelScene.js';

export interface V7SourceLayer extends StarshipPixelSceneLayer {
  dataURL: string;
}

export interface V7SourceProject extends StarshipPixelSceneManifest {
  layers: V7SourceLayer[];
}

const sourceHtml = [c00, c01, c02, c03, c04, c05, c06, c07, c08, c09, c10, c11, c12, c13, c14, c15, c16].join('');
const marker = 'window.SPACE_LAB_PROJECT = ';
const start = sourceHtml.indexOf(marker);
if (start < 0) throw new Error('V7 source project marker not found');
const jsonStart = start + marker.length;
const jsonEnd = sourceHtml.indexOf(';\n', jsonStart);
if (jsonEnd < 0) throw new Error('V7 source project terminator not found');

export const V7_SOURCE_PROJECT = JSON.parse(
  sourceHtml.slice(jsonStart, jsonEnd),
) as V7SourceProject;

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { DUCTOR_STATUS_MAX_BYTES } from '../../../constants.js';
import { DUCTOR_ROLE_NAMES, type DuctorRoleName } from './ductorStatusFile.js';

export const DUCTOR_OBSERVATION_TABS = ['code', 'terminal', 'browser'] as const;
export const DUCTOR_OBSERVATION_TITLE_MAX_CHARS = 96;
export const DUCTOR_OBSERVATION_CONTENT_MAX_CHARS = 1_536;

export type DuctorObservationTab = (typeof DUCTOR_OBSERVATION_TABS)[number];

export interface DuctorObservationFeed {
  title: string;
  content: string;
  updatedAt: string;
}

export interface DuctorObservationFile {
  version: 1;
  roles: Partial<Record<DuctorRoleName, Partial<Record<DuctorObservationTab, DuctorObservationFeed>>>>;
}

const TOP_LEVEL_KEYS = new Set(['version', 'roles']);
const FEED_KEYS = new Set(['title', 'content', 'updatedAt']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function isRoleName(value: string): value is DuctorRoleName {
  return (DUCTOR_ROLE_NAMES as readonly string[]).includes(value);
}

function isTab(value: string): value is DuctorObservationTab {
  return (DUCTOR_OBSERVATION_TABS as readonly string[]).includes(value);
}

function canonicalTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return null;
  const timestamp = new Date(value).toISOString();
  return timestamp === value ? timestamp : null;
}

function isTitle(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= DUCTOR_OBSERVATION_TITLE_MAX_CHARS &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function isContent(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= DUCTOR_OBSERVATION_CONTENT_MAX_CHARS &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  );
}

export function parseDuctorObservationFile(value: unknown): DuctorObservationFile {
  if (!isRecord(value) || !hasOnlyKeys(value, TOP_LEVEL_KEYS) || value['version'] !== 1 || !isRecord(value['roles'])) {
    throw new Error('observation file must use version 1 with only roles');
  }

  const roles: DuctorObservationFile['roles'] = {};
  for (const [name, roleValue] of Object.entries(value['roles'])) {
    if (!isRoleName(name) || !isRecord(roleValue)) {
      throw new Error('observation file contains an unknown role or property');
    }
    const feeds: Partial<Record<DuctorObservationTab, DuctorObservationFeed>> = {};
    for (const [tab, candidate] of Object.entries(roleValue)) {
      if (!isTab(tab) || !isRecord(candidate) || !hasOnlyKeys(candidate, FEED_KEYS)) {
        throw new Error('observation file contains an unknown feed or property');
      }
      const updatedAt = canonicalTimestamp(candidate['updatedAt']);
      if (!isTitle(candidate['title']) || !isContent(candidate['content']) || !updatedAt) {
        throw new Error('observation file contains invalid feed content');
      }
      feeds[tab] = { title: candidate['title'], content: candidate['content'], updatedAt };
    }
    if (Object.keys(feeds).length === 0) {
      throw new Error('observation file role must include a feed');
    }
    roles[name] = feeds;
  }
  return { version: 1, roles };
}

function resolveFileBelowRoot(rootPath: string, filePath: string): string {
  const root = path.resolve(rootPath);
  const candidate = path.resolve(root, filePath);
  const relative = path.relative(root, candidate);
  if (relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('observation file must be below the configured root');
  }
  return candidate;
}

function rejectSymlinkComponents(rootPath: string, candidate: string): void {
  const root = path.resolve(rootPath);
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error('observation root must be a real directory');
  }
  let current = root;
  for (const segment of path.relative(root, candidate).split(path.sep)) {
    current = path.join(current, segment);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) throw new Error('observation path cannot contain symlinks');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
  }
}

export function readDuctorObservationFile(
  rootPath: string,
  observationFile: string,
): DuctorObservationFile | null {
  const candidate = resolveFileBelowRoot(rootPath, observationFile);
  rejectSymlinkComponents(rootPath, candidate);
  let descriptor: number;
  try {
    descriptor = fs.openSync(candidate, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || stat.size > DUCTOR_STATUS_MAX_BYTES) {
      throw new Error('observation file is not a regular bounded file');
    }
    return parseDuctorObservationFile(JSON.parse(fs.readFileSync(descriptor, 'utf8')) as unknown);
  } finally {
    fs.closeSync(descriptor);
  }
}

export function writeDuctorObservationFile(
  rootPath: string,
  observationFile: string,
  value: DuctorObservationFile,
): void {
  const candidate = resolveFileBelowRoot(rootPath, observationFile);
  const parent = path.dirname(candidate);
  rejectSymlinkComponents(rootPath, parent);
  fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
  rejectSymlinkComponents(rootPath, candidate);

  const serialized = `${JSON.stringify(parseDuctorObservationFile(value), null, 2)}\n`;
  if (Buffer.byteLength(serialized) > DUCTOR_STATUS_MAX_BYTES) {
    throw new Error('observation file is too large');
  }

  const temporary = path.join(parent, `.${path.basename(candidate)}.${process.pid.toString()}.${crypto.randomUUID()}.tmp`);
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(descriptor, serialized, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    fs.renameSync(temporary, candidate);
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
    try {
      fs.unlinkSync(temporary);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}

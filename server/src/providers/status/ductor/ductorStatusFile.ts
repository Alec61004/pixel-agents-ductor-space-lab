import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { DUCTOR_STATUS_MAX_BYTES, DUCTOR_TASK_LABEL_MAX_CHARS } from '../../../constants.js';

export const DUCTOR_ROLE_NAMES = ['Alec', 'Kevin', 'Benjamin'] as const;
export const DUCTOR_REPORTED_STATES = [
  'idle',
  'working',
  'waiting',
  'review',
  'blocked',
  'offline',
] as const;

export type DuctorRoleName = (typeof DUCTOR_ROLE_NAMES)[number];
export type DuctorRoleState = (typeof DUCTOR_REPORTED_STATES)[number];

export interface DuctorRoleReport {
  state: DuctorRoleState;
  taskLabel?: string;
  updatedAt: string;
}

export interface DuctorStatusFile {
  version: 1;
  roles: Partial<Record<DuctorRoleName, DuctorRoleReport>>;
}

const TOP_LEVEL_KEYS = new Set(['version', 'roles']);
const REPORT_KEYS = new Set(['state', 'taskLabel', 'updatedAt']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function isRoleName(value: string): value is DuctorRoleName {
  return (DUCTOR_ROLE_NAMES as readonly string[]).includes(value);
}

export function isReportedDuctorState(value: unknown): value is DuctorRoleState {
  return typeof value === 'string' && (DUCTOR_REPORTED_STATES as readonly string[]).includes(value);
}

export function sanitizeDuctorTaskLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const label = value
    .replace(/[\u0000-\u001f\u007f]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  return label ? label.slice(0, DUCTOR_TASK_LABEL_MAX_CHARS) : null;
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

export function parseDuctorStatusFile(value: unknown): DuctorStatusFile {
  if (!isRecord(value) || !hasOnlyKeys(value, TOP_LEVEL_KEYS)) {
    throw new Error('status file must contain only version and roles');
  }
  if (value.version !== 1 || !isRecord(value.roles)) {
    throw new Error('status file must use version 1 with a roles object');
  }

  const roles: DuctorStatusFile['roles'] = {};
  for (const [name, candidate] of Object.entries(value.roles)) {
    if (!isRoleName(name) || !isRecord(candidate) || !hasOnlyKeys(candidate, REPORT_KEYS)) {
      throw new Error('status file contains an unknown role or property');
    }
    if (!isReportedDuctorState(candidate.state)) {
      throw new Error('status file contains an unknown state');
    }
    const updatedAt = normalizeTimestamp(candidate.updatedAt);
    if (
      !updatedAt ||
      (candidate.taskLabel !== undefined && typeof candidate.taskLabel !== 'string')
    ) {
      throw new Error('status file contains an invalid timestamp or task label');
    }
    const taskLabel = sanitizeDuctorTaskLabel(candidate.taskLabel);
    roles[name] = {
      state: candidate.state,
      ...(taskLabel ? { taskLabel } : {}),
      updatedAt,
    };
  }

  return { version: 1, roles };
}

function resolveAllowedStatusPath(statusRoot: string, statusFile: string): string {
  const root = path.resolve(statusRoot);
  const candidate = path.resolve(root, statusFile);
  const relative = path.relative(root, candidate);
  if (
    relative === '' ||
    relative.startsWith(`..${path.sep}`) ||
    relative === '..' ||
    path.isAbsolute(relative)
  ) {
    throw new Error('status file must be a file below the configured root');
  }
  return candidate;
}

function rejectSymlinkComponents(statusRoot: string, candidate: string): void {
  const root = path.resolve(statusRoot);
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error('status root must be a real directory');
  }

  let current = root;
  for (const segment of path.relative(root, candidate).split(path.sep)) {
    current = path.join(current, segment);
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) throw new Error('status path cannot contain symlinks');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
  }
}

export function readDuctorStatusFile(
  statusRoot: string,
  statusFile: string,
): DuctorStatusFile | null {
  const candidate = resolveAllowedStatusPath(statusRoot, statusFile);
  rejectSymlinkComponents(statusRoot, candidate);

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
      throw new Error('status file is not a regular bounded file');
    }
    const raw = fs.readFileSync(descriptor, 'utf8');
    return parseDuctorStatusFile(JSON.parse(raw) as unknown);
  } finally {
    fs.closeSync(descriptor);
  }
}

export function writeDuctorStatusFile(
  statusRoot: string,
  statusFile: string,
  value: DuctorStatusFile,
): void {
  const candidate = resolveAllowedStatusPath(statusRoot, statusFile);
  const parent = path.dirname(candidate);
  rejectSymlinkComponents(statusRoot, parent);
  fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
  rejectSymlinkComponents(statusRoot, candidate);

  const normalized = parseDuctorStatusFile(value);
  const serialized = `${JSON.stringify(normalized, null, 2)}\n`;
  if (Buffer.byteLength(serialized) > DUCTOR_STATUS_MAX_BYTES) {
    throw new Error('status file is too large');
  }

  const temporary = path.join(
    parent,
    `.${path.basename(candidate)}.${process.pid.toString()}.${crypto.randomUUID()}.tmp`,
  );
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

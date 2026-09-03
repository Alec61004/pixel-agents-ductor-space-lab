import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  DUCTOR_ROLE_NAMES,
  type DuctorRoleName,
  type DuctorRoleState,
  readDuctorStatusFile,
  sanitizeDuctorTaskLabel,
} from './ductorStatusFile.js';

export type { DuctorRoleName, DuctorRoleState } from './ductorStatusFile.js';
export { DUCTOR_ROLE_NAMES } from './ductorStatusFile.js';

export function isSafeDuctorLabHost(host: string): boolean {
  return ['127.0.0.1', 'localhost', '::1'].includes(host.trim().toLowerCase());
}

export type DuctorPresence = 'online' | 'offline';

export interface DuctorRoleStatus {
  name: DuctorRoleName;
  presence: DuctorPresence;
  state: DuctorRoleState;
  taskLabel: string | null;
  updatedAt: string;
  /** True when the bridge inferred the state from presence instead of receiving a report. */
  derived: boolean;
}

export interface DuctorStatusSnapshot {
  theme: 'ductor-space-lab';
  roles: DuctorRoleStatus[];
}

type RawRoleStatus = Record<string, unknown>;
type RawRoles = Partial<Record<DuctorRoleName, RawRoleStatus>>;
type RolePresence = Record<DuctorRoleName, boolean>;

const STATE_ALIASES: Readonly<Record<string, DuctorRoleState>> = {
  active: 'working',
  blocked: 'blocked',
  complete: 'idle',
  completed: 'idle',
  done: 'idle',
  error: 'blocked',
  failed: 'blocked',
  idle: 'idle',
  in_progress: 'working',
  offline: 'offline',
  qa: 'review',
  queued: 'waiting',
  review: 'review',
  reviewing: 'review',
  running: 'working',
  waiting: 'waiting',
  working: 'working',
};

const LOCAL_STATUS_FRESHNESS_MS = 45 * 60_000;

export function mapDuctorState(rawState: unknown, present: boolean): DuctorRoleState {
  if (!present) return 'offline';
  if (typeof rawState !== 'string') return 'idle';
  return STATE_ALIASES[rawState.trim().toLowerCase()] ?? 'idle';
}

function publicTaskLabel(value: unknown): string | null {
  return sanitizeDuctorTaskLabel(value);
}

function publicTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return fallback;
  return new Date(value).toISOString();
}

function isFreshReport(value: unknown, observedAt: string): boolean {
  if (typeof value !== 'string') return false;
  const reportTime = Date.parse(value);
  const observedTime = Date.parse(observedAt);
  if (Number.isNaN(reportTime) || Number.isNaN(observedTime)) return false;
  const age = observedTime - reportTime;
  return age >= 0 && age <= LOCAL_STATUS_FRESHNESS_MS;
}

function isReportedState(value: unknown): boolean {
  return typeof value === 'string' && value.trim().toLowerCase() in STATE_ALIASES;
}

/**
 * Project arbitrary source data onto the deliberately small public contract.
 * Unknown fields never cross the bridge, including message bodies, results,
 * credentials, or provider configuration.
 */
export function normalizeDuctorRoles(
  rawRoles: RawRoles,
  presence: RolePresence,
  observedAt: string,
): DuctorStatusSnapshot {
  return {
    theme: 'ductor-space-lab',
    roles: DUCTOR_ROLE_NAMES.map((name): DuctorRoleStatus => {
      const raw = rawRoles[name] ?? {};
      const present = Boolean(presence[name]);
      const state = mapDuctorState(raw.state, present);
      const reported =
        present && isReportedState(raw.state) && isFreshReport(raw.updatedAt, observedAt);
      const isOnline = reported && state !== 'offline';
      return {
        name,
        presence: isOnline ? 'online' : 'offline',
        state: reported ? state : 'offline',
        taskLabel: reported && isOnline ? publicTaskLabel(raw.taskLabel) : null,
        updatedAt: publicTimestamp(raw.updatedAt, observedAt),
        derived: !reported,
      };
    }),
  };
}

export interface DuctorStatusProviderOptions {
  ductorHome?: string;
  statusFile?: string;
  statusRoot?: string;
  env?: NodeJS.ProcessEnv;
  exists?: (filePath: string) => boolean;
  now?: () => Date;
}

/**
 * Local, read-only Ductor adapter. Presence comes only from documented
 * workspace-directory conventions. When configured, a strict repo-local JSON
 * heartbeat is re-read for every snapshot. Exact environment variables remain
 * a backwards-compatible fallback only when no heartbeat path is configured.
 * The adapter never enumerates the environment or opens registry/session/task
 * files.
 */
export class DuctorStatusProvider {
  private readonly ductorHome: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly statusFile: string | undefined;
  private readonly statusRoot: string;
  private readonly exists: (filePath: string) => boolean;
  private readonly now: () => Date;

  constructor(options: DuctorStatusProviderOptions = {}) {
    this.env = options.env ?? process.env;
    this.ductorHome =
      options.ductorHome ?? this.env['DUCTOR_HOME'] ?? path.join(os.homedir(), '.ductor');
    this.statusFile = options.statusFile ?? this.env['PIXEL_AGENTS_DUCTOR_STATUS_FILE'];
    this.statusRoot = options.statusRoot ?? process.cwd();
    this.exists = options.exists ?? fs.existsSync;
    this.now = options.now ?? (() => new Date());
  }

  snapshot(): DuctorStatusSnapshot {
    const presence: RolePresence = {
      Alec: this.exists(path.join(this.ductorHome, 'workspace')),
      Kevin: this.exists(path.join(this.ductorHome, 'agents', 'kevin', 'workspace')),
      Benjamin: this.exists(path.join(this.ductorHome, 'agents', 'benjamin', 'workspace')),
    };

    const rawRoles = this.readRawRoles();

    return normalizeDuctorRoles(rawRoles, presence, this.now().toISOString());
  }

  private readRawRoles(): RawRoles {
    if (this.statusFile) {
      try {
        const reports = readDuctorStatusFile(this.statusRoot, this.statusFile)?.roles ?? {};
        return Object.fromEntries(
          Object.entries(reports).map(([name, report]) => [name, { ...report }]),
        ) as RawRoles;
      } catch {
        return {};
      }
    }

    return Object.fromEntries(
      DUCTOR_ROLE_NAMES.map((name) => {
        const prefix = `PIXEL_AGENTS_DUCTOR_${name.toUpperCase()}`;
        return [
          name,
          {
            state: this.env[`${prefix}_STATE`],
            taskLabel: this.env[`${prefix}_TASK`],
            updatedAt: this.env[`${prefix}_UPDATED_AT`],
          },
        ];
      }),
    ) as RawRoles;
  }
}

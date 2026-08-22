import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export const DUCTOR_ROLE_NAMES = ['Alec', 'Kevin', 'Benjamin'] as const;

export type DuctorRoleName = (typeof DUCTOR_ROLE_NAMES)[number];
export type DuctorPresence = 'online' | 'offline';
export type DuctorRoleState = 'idle' | 'working' | 'waiting' | 'review' | 'blocked' | 'offline';

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

export function mapDuctorState(rawState: unknown, present: boolean): DuctorRoleState {
  if (!present) return 'offline';
  if (typeof rawState !== 'string') return 'idle';
  return STATE_ALIASES[rawState.trim().toLowerCase()] ?? 'idle';
}

function publicTaskLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const label = value.replace(/\s+/g, ' ').trim();
  return label ? label.slice(0, 120) : null;
}

function publicTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return fallback;
  return new Date(value).toISOString();
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
      const present = presence[name];
      const reported = present && isReportedState(raw.state);
      return {
        name,
        presence: present ? 'online' : 'offline',
        state: mapDuctorState(raw.state, present),
        taskLabel: reported ? publicTaskLabel(raw.taskLabel) : null,
        updatedAt: reported ? publicTimestamp(raw.updatedAt, observedAt) : observedAt,
        derived: !reported,
      };
    }),
  };
}

export interface DuctorStatusProviderOptions {
  ductorHome?: string;
  env?: NodeJS.ProcessEnv;
  exists?: (filePath: string) => boolean;
  now?: () => Date;
}

/**
 * Local, read-only Ductor adapter. Presence comes only from documented
 * workspace-directory conventions. Optional high-level activity comes from
 * six explicitly named environment variables per role; the adapter never
 * enumerates the environment or opens Ductor registry/session/task files.
 */
export class DuctorStatusProvider {
  private readonly ductorHome: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly exists: (filePath: string) => boolean;
  private readonly now: () => Date;

  constructor(options: DuctorStatusProviderOptions = {}) {
    this.ductorHome = options.ductorHome ?? path.join(os.homedir(), '.ductor');
    this.env = options.env ?? process.env;
    this.exists = options.exists ?? fs.existsSync;
    this.now = options.now ?? (() => new Date());
  }

  snapshot(): DuctorStatusSnapshot {
    const presence: RolePresence = {
      Alec: this.exists(path.join(this.ductorHome, 'workspace')),
      Kevin: this.exists(path.join(this.ductorHome, 'agents', 'kevin', 'workspace')),
      Benjamin: this.exists(path.join(this.ductorHome, 'agents', 'benjamin', 'workspace')),
    };

    const rawRoles = Object.fromEntries(
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

    return normalizeDuctorRoles(rawRoles, presence, this.now().toISOString());
  }
}

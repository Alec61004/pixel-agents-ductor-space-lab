#!/usr/bin/env node

import {
  DUCTOR_REPORTED_STATES,
  DUCTOR_ROLE_NAMES,
  isReportedDuctorState,
  readDuctorStatusFile,
  sanitizeDuctorTaskLabel,
  type DuctorRoleName,
  type DuctorStatusFile,
  writeDuctorStatusFile,
} from '../server/src/providers/status/ductor/ductorStatusFile.js';

function usage(): never {
  throw new Error(
    'usage: ductor-statusctl --file <repo-local.json> status | set <role> <state> [--task <label>] [--timestamp <ISO>] | clear <role> | reset',
  );
}

function takeOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  if (args.indexOf(name, index + 1) >= 0 || index + 1 >= args.length) usage();
  const [value] = args.splice(index, 2).slice(1);
  return value;
}

function roleName(value: string | undefined): DuctorRoleName {
  if (!value || !(DUCTOR_ROLE_NAMES as readonly string[]).includes(value)) {
    throw new Error('unknown role');
  }
  return value as DuctorRoleName;
}

function load(statusRoot: string, statusFile: string): DuctorStatusFile {
  return readDuctorStatusFile(statusRoot, statusFile) ?? { version: 1, roles: {} };
}

function main(): void {
  const args = process.argv.slice(2);
  const statusFile = takeOption(args, '--file');
  if (!statusFile) usage();
  const statusRoot = process.cwd();
  const command = args.shift();

  if (command === 'status' && args.length === 0) {
    process.stdout.write(`${JSON.stringify(load(statusRoot, statusFile), null, 2)}\n`);
    return;
  }

  if (command === 'reset' && args.length === 0) {
    writeDuctorStatusFile(statusRoot, statusFile, { version: 1, roles: {} });
    return;
  }

  if (command === 'clear') {
    const role = roleName(args.shift());
    if (args.length !== 0) usage();
    const current = load(statusRoot, statusFile);
    delete current.roles[role];
    writeDuctorStatusFile(statusRoot, statusFile, current);
    return;
  }

  if (command === 'set') {
    const role = roleName(args.shift());
    const state = args.shift();
    const task = takeOption(args, '--task');
    const timestamp = takeOption(args, '--timestamp') ?? new Date().toISOString();
    if (!isReportedDuctorState(state) || args.length !== 0) {
      throw new Error(`unknown state; expected one of ${DUCTOR_REPORTED_STATES.join(', ')}`);
    }
    const normalizedTimestamp = new Date(timestamp);
    if (Number.isNaN(normalizedTimestamp.getTime())) throw new Error('timestamp must be ISO-8601');
    const taskLabel = sanitizeDuctorTaskLabel(task);
    const current = load(statusRoot, statusFile);
    current.roles[role] = {
      state,
      ...(taskLabel ? { taskLabel } : {}),
      updatedAt: normalizedTimestamp.toISOString(),
    };
    writeDuctorStatusFile(statusRoot, statusFile, current);
    return;
  }

  usage();
}

try {
  main();
} catch (error) {
  process.stderr.write(`ductor-statusctl: ${error instanceof Error ? error.message : 'failed'}\n`);
  process.exitCode = 1;
}

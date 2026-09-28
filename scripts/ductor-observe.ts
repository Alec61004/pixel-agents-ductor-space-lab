#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  DUCTOR_OBSERVATION_CONTENT_MAX_CHARS,
  DUCTOR_OBSERVATION_TABS,
  type DuctorObservationTab,
  readDuctorObservationFile,
  writeDuctorObservationFile,
} from '../server/src/providers/status/ductor/ductorObservationFile.js';
import { DUCTOR_ROLE_NAMES, type DuctorRoleName } from '../server/src/providers/status/ductor/ductorStatusFile.js';

function usage(): never {
  throw new Error(
    'usage: ductor-observe --file <repo-local.json> --role <Alec|Kevin|Benjamin> --tab <code|terminal|browser> --title <label> --content-file <repo-local.txt>',
  );
}

function takeOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  if (args.indexOf(name, index + 1) >= 0 || index + 1 >= args.length) usage();
  const value = args[index + 1];
  args.splice(index, 2);
  return value;
}

function isRole(value: string | undefined): value is DuctorRoleName {
  return typeof value === 'string' && (DUCTOR_ROLE_NAMES as readonly string[]).includes(value);
}

function isTab(value: string | undefined): value is DuctorObservationTab {
  return typeof value === 'string' && (DUCTOR_OBSERVATION_TABS as readonly string[]).includes(value);
}

function resolveSafeSource(root: string, sourceFile: string): string {
  const rootPath = path.resolve(root);
  const candidate = path.resolve(rootPath, sourceFile);
  const relative = path.relative(rootPath, candidate);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('observation source must be a file below the repository root');
  }
  if (
    relative.split(path.sep).some((segment) =>
      segment === '.git' || /^\.env(?:\.|$)/iu.test(segment) || /^(?:id_rsa|credentials?|secrets?)$/iu.test(segment),
    )
  ) {
    throw new Error('observation source cannot be a credential file');
  }
  const stat = fs.lstatSync(candidate);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > DUCTOR_OBSERVATION_CONTENT_MAX_CHARS) {
    throw new Error('observation source must be a bounded regular file');
  }
  return candidate;
}

function main(): void {
  const args = process.argv.slice(2);
  const observationFile = takeOption(args, '--file');
  const role = takeOption(args, '--role');
  const tab = takeOption(args, '--tab');
  const title = takeOption(args, '--title');
  const contentFile = takeOption(args, '--content-file');
  if (!observationFile || !isRole(role) || !isTab(tab) || !title || !contentFile || args.length !== 0) usage();

  const repositoryRoot = process.cwd();
  const content = fs.readFileSync(resolveSafeSource(repositoryRoot, contentFile), 'utf8');
  const current = readDuctorObservationFile(repositoryRoot, observationFile) ?? { version: 1 as const, roles: {} };
  const roleFeeds = { ...(current.roles[role] ?? {}) };
  roleFeeds[tab] = { title, content, updatedAt: new Date().toISOString() };
  current.roles[role] = roleFeeds;
  writeDuctorObservationFile(repositoryRoot, observationFile, current);
}

try {
  main();
} catch (error) {
  process.stderr.write(`ductor-observe: ${error instanceof Error ? error.message : 'failed'}\n`);
  process.exitCode = 1;
}

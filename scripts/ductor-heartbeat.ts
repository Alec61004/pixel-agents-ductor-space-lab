#!/usr/bin/env node

import { randomBytes } from 'node:crypto';
import * as path from 'node:path';

import {
  type CloudPublisherState,
  loadCloudPublisherConfig,
  publisherBackoffMs,
  runCloudPublisherCycle,
} from '../server/src/providers/status/ductor/ductorCloudPublisher.js';

function usage(): never {
  throw new Error(
    'usage: ductor-heartbeat --file <repo-local.json> --config <repo-local.env> [--once] [--interval-ms <1000-60000>]',
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

function takeFlag(args: string[], name: string): boolean {
  const indexes = args.flatMap((value, index) => (value === name ? [index] : []));
  if (indexes.length > 1) usage();
  if (indexes.length === 0) return false;
  args.splice(indexes[0] ?? 0, 1);
  return true;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const statusFile = takeOption(args, '--file');
  const configFile = takeOption(args, '--config');
  const suppliedObservationFile = takeOption(args, '--observation-file');
  const intervalRaw = takeOption(args, '--interval-ms') ?? '5000';
  const once = takeFlag(args, '--once');
  const intervalMs = Number(intervalRaw);
  if (
    !statusFile ||
    !configFile ||
    args.length !== 0 ||
    !Number.isSafeInteger(intervalMs) ||
    intervalMs < 1_000 ||
    intervalMs > 60_000
  ) {
    usage();
  }

  const repositoryRoot = process.cwd();
  const observationFile = suppliedObservationFile ?? path.join(path.dirname(statusFile), 'observation.json');
  const config = loadCloudPublisherConfig(repositoryRoot, configFile);
  let stopped = false;
  let pendingTimer: NodeJS.Timeout | null = null;
  let resolveDelay: (() => void) | null = null;
  const stop = (): void => {
    stopped = true;
    if (pendingTimer) clearTimeout(pendingTimer);
    resolveDelay?.();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  let state: CloudPublisherState = { fingerprint: null, lastPublishedAt: null };
  let failures = 0;
  do {
    try {
      state = await runCloudPublisherCycle({
        config,
        nonce: randomBytes(24).toString('hex'),
        now: new Date(),
        repositoryRoot,
        state,
        statusFile,
        observationFile,
      });
      failures = 0;
      if (once) return;
    } catch {
      if (once) throw new Error('publish failed');
      process.stderr.write('ductor-heartbeat: publish failed; retrying\n');
      failures += 1;
    }

    const delayMs = failures > 0 ? publisherBackoffMs(failures - 1) : intervalMs;
    if (!stopped) {
      await new Promise<void>((resolve) => {
        resolveDelay = resolve;
        pendingTimer = setTimeout(resolve, delayMs);
      });
      pendingTimer = null;
      resolveDelay = null;
    }
  } while (!stopped);
}

void main().catch(() => {
  process.stderr.write('ductor-heartbeat: stopped with an error\n');
  process.exitCode = 1;
});

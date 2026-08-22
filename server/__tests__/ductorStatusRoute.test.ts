import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { AgentStateStore } from '../src/agentStateStore.js';
import { createHttpServer, type HttpServerHandle } from '../src/httpServer.js';
import {
  DuctorStatusProvider,
  isSafeDuctorLabHost,
} from '../src/providers/status/ductor/ductorStatusProvider.js';

describe('Ductor localhost status bridge', () => {
  let handle: HttpServerHandle | null = null;

  afterEach(async () => {
    await handle?.app.close();
    handle = null;
  });

  it.each(['127.0.0.1', 'localhost', '::1'])('accepts loopback host %s', (host) => {
    expect(isSafeDuctorLabHost(host)).toBe(true);
  });

  it.each(['0.0.0.0', '::', '192.168.1.10', 'lab.example'])(
    'rejects non-loopback host %s',
    (host) => {
      expect(isSafeDuctorLabHost(host)).toBe(false);
    },
  );

  it('does not expose the Ductor endpoint unless the provider is enabled', async () => {
    handle = await createHttpServer({
      embedded: false,
      host: '127.0.0.1',
      token: 'test-token',
      store: new AgentStateStore(),
    });

    const response = await fetch(`http://127.0.0.1:${handle.port.toString()}/api/ductor/status`);

    expect(response.status).toBe(404);
  });

  it('returns only the provider snapshot with no-store caching when enabled', async () => {
    handle = await createHttpServer({
      embedded: false,
      host: '127.0.0.1',
      token: 'test-token',
      store: new AgentStateStore(),
      ductorStatusProvider: {
        snapshot: () => ({
          theme: 'ductor-space-lab',
          roles: [
            {
              name: 'Alec',
              presence: 'online',
              state: 'working',
              taskLabel: 'Coordinate MVP',
              updatedAt: '2026-08-22T05:30:00.000Z',
              derived: false,
            },
          ],
        }),
      },
    });

    const response = await fetch(`http://127.0.0.1:${handle.port.toString()}/api/ductor/status`);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      theme: 'ductor-space-lab',
      roles: [
        {
          name: 'Alec',
          presence: 'online',
          state: 'working',
          taskLabel: 'Coordinate MVP',
          updatedAt: '2026-08-22T05:30:00.000Z',
          derived: false,
        },
      ],
    });
  });

  it('serves changed file-backed role states without restarting the server', async () => {
    const statusRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pxl-ductor-route-'));
    const statusFile = path.join(statusRoot, 'status.json');
    const writeRoles = (states: readonly [string, string, string]) => {
      fs.writeFileSync(
        statusFile,
        JSON.stringify({
          version: 1,
          roles: Object.fromEntries(
            ['Alec', 'Kevin', 'Benjamin'].map((role, index) => [
              role,
              {
                state: states[index],
                taskLabel: `${role} live`,
                updatedAt: '2026-08-22T05:30:00.000Z',
              },
            ]),
          ),
        }),
      );
    };

    try {
      writeRoles(['working', 'waiting', 'review']);
      handle = await createHttpServer({
        embedded: false,
        host: '127.0.0.1',
        token: 'test-token',
        store: new AgentStateStore(),
        ductorStatusProvider: new DuctorStatusProvider({
          statusFile,
          statusRoot,
          exists: () => true,
        }),
      });

      const first = await fetch(`http://127.0.0.1:${handle.port.toString()}/api/ductor/status`);
      expect(
        ((await first.json()) as { roles: Array<{ state: string }> }).roles.map(
          (role) => role.state,
        ),
      ).toEqual(['working', 'waiting', 'review']);

      writeRoles(['review', 'working', 'blocked']);
      const second = await fetch(`http://127.0.0.1:${handle.port.toString()}/api/ductor/status`);
      expect(
        ((await second.json()) as { roles: Array<{ state: string }> }).roles.map(
          (role) => role.state,
        ),
      ).toEqual(['review', 'working', 'blocked']);
    } finally {
      fs.rmSync(statusRoot, { recursive: true, force: true });
    }
  });
});

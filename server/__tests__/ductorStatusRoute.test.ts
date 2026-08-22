import { afterEach, describe, expect, it } from 'vitest';

import { AgentStateStore } from '../src/agentStateStore.js';
import { createHttpServer, type HttpServerHandle } from '../src/httpServer.js';
import { isSafeDuctorLabHost } from '../src/providers/status/ductor/ductorStatusProvider.js';

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
});

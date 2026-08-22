import {
  acceptCloudWrite,
  CLOUD_STATUS_MAX_BYTES,
  type CloudStoredEnvelope,
  projectCloudStatus,
} from './ductorCloud.js';

export interface CloudStatusStore {
  read(): Promise<CloudStoredEnvelope | null>;
  write(envelope: CloudStoredEnvelope): Promise<void>;
}

const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'cache-control': 'private, no-store',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

function response(
  status: number,
  payload?: unknown,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(payload === undefined ? null : JSON.stringify(payload), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      ...(payload === undefined ? {} : { 'content-type': 'application/json; charset=utf-8' }),
      ...extraHeaders,
    },
  });
}

function rejected(status: number, extraHeaders?: Record<string, string>): Response {
  return response(status, { error: 'request rejected' }, extraHeaders);
}

function isSameOriginOrNonBrowser(request: Request): boolean {
  const origin = request.headers.get('origin');
  return origin === null || origin === new URL(request.url).origin;
}

export function createCloudHeartbeatHandler(options: {
  now?: () => Date;
  secret: string | undefined;
  store: CloudStatusStore;
}): (request: Request) => Promise<Response> {
  const now = options.now ?? (() => new Date());
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return rejected(405, { allow: 'POST' });
    if (!isSameOriginOrNonBrowser(request)) return rejected(403);
    if (request.headers.get('content-type')?.split(';', 1)[0]?.trim() !== 'application/json') {
      return rejected(415);
    }
    const declaredLength = request.headers.get('content-length');
    if (declaredLength !== null) {
      const parsedLength = Number(declaredLength);
      if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) return rejected(400);
      if (parsedLength > CLOUD_STATUS_MAX_BYTES) return rejected(413);
    }
    if (!options.secret || options.secret.length < 32) return rejected(503);

    let body: string;
    try {
      body = await request.text();
    } catch {
      return rejected(400);
    }
    if (Buffer.byteLength(body) > CLOUD_STATUS_MAX_BYTES) return rejected(413);

    const issuedAt = Number(request.headers.get('x-ductor-issued-at'));
    const nonce = request.headers.get('x-ductor-nonce') ?? '';
    const signature = request.headers.get('x-ductor-signature') ?? '';
    const observedAt = now();
    let authenticated: CloudStoredEnvelope;
    try {
      authenticated = acceptCloudWrite({
        body,
        current: null,
        issuedAt,
        nonce,
        now: observedAt,
        secret: options.secret,
        signature,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      return rejected(message === 'unauthorized' ? 401 : 422);
    }

    try {
      const current = await options.store.read();
      const accepted = current
        ? acceptCloudWrite({
            body,
            current,
            issuedAt,
            nonce,
            now: observedAt,
            secret: options.secret,
            signature,
          })
        : authenticated;
      await options.store.write(accepted);
      return response(204);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'conflict') return rejected(409);
      if (message === 'rate limited') return rejected(429, { 'retry-after': '1' });
      return rejected(503);
    }
  };
}

export function createCloudStatusHandler(options: {
  now?: () => Date;
  store: Pick<CloudStatusStore, 'read'>;
}): (request: Request) => Promise<Response> {
  const now = options.now ?? (() => new Date());
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET') return rejected(405, { allow: 'GET' });
    if (!isSameOriginOrNonBrowser(request)) return rejected(403);
    try {
      return response(200, projectCloudStatus(await options.store.read(), now()));
    } catch {
      return response(200, projectCloudStatus(null, now()));
    }
  };
}

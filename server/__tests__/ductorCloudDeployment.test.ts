import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Ductor cloud deployment configuration', () => {
  it('builds only the web surface with private security headers and no public source view', () => {
    const config = JSON.parse(readFileSync(resolve('..', 'vercel.json'), 'utf8')) as {
      buildCommand: string;
      framework: string;
      headers: Array<{ headers: Array<{ key: string; value: string }>; source: string }>;
      installCommand: string;
      outputDirectory: string;
      public: boolean;
    };

    expect(config.framework).toBe('vite');
    expect(config.buildCommand).toBe('npm run build:ductor-cloud');
    expect(config.installCommand).toBe('npm ci --ignore-scripts');
    expect(config.outputDirectory).toBe('dist/webview');
    expect(config.public).toBeUndefined();
    const headers = Object.fromEntries(
      config.headers[0]?.headers.map(({ key, value }) => [key.toLowerCase(), value]) ?? [],
    );
    expect(headers['content-security-policy']).toContain("connect-src 'self'");
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['strict-transport-security']).toContain('max-age=');
  });
});

import assert from 'node:assert/strict';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'vitest';

import { DuctorLab } from '../src/ductor/DuctorLab.js';
import type { DuctorStatusSnapshot } from '../src/ductor/ductorLabModel.js';

const snapshot: DuctorStatusSnapshot = {
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
    {
      name: 'Kevin',
      presence: 'online',
      state: 'working',
      taskLabel: 'Implement bridge',
      updatedAt: '2026-08-22T05:30:00.000Z',
      derived: false,
    },
    {
      name: 'Benjamin',
      presence: 'online',
      state: 'review',
      taskLabel: 'Review contract',
      updatedAt: '2026-08-22T05:30:00.000Z',
      derived: false,
    },
  ],
};

test('renders exactly three accessible role stations and simultaneous activity', () => {
  const markup = renderToStaticMarkup(createElement(DuctorLab, { snapshot }));

  assert.equal((markup.match(/data-role-card=/g) ?? []).length, 3);
  assert.match(markup, /aria-label="Alec, Coordinator, working"/);
  assert.match(markup, /aria-label="Kevin, Implementer, working"/);
  assert.match(markup, /aria-label="Benjamin, Reviewer, review"/);
  assert.equal((markup.match(/data-state="working"/g) ?? []).length, 2);
  assert.equal((markup.match(/crew-sprites\.webp/g) ?? []).length, 3);
  assert.doesNotMatch(markup, /characters\/char_[0-9]\.png/);
  assert.match(markup, /data-portrait="purple-commander"/);
  assert.match(markup, /data-portrait="cyan-engineer"/);
  assert.match(markup, /data-portrait="red-sentinel"/);
  assert.match(markup, /Ductor Space Lab/);
  assert.match(markup, /Signals marked derived are presence-based/);
});

test('labels cloud provenance and stale offline status honestly', () => {
  const staleSnapshot: DuctorStatusSnapshot = {
    ...snapshot,
    publishedAt: '2026-08-22T05:30:00.000Z',
    stale: true,
    roles: snapshot.roles.map((role) => ({
      ...role,
      presence: 'offline',
      state: 'offline',
      taskLabel: null,
      derived: true,
      provenance: 'stale-cloud-heartbeat',
    })),
  };

  const markup = renderToStaticMarkup(createElement(DuctorLab, { snapshot: staleSnapshot }));

  assert.match(markup, /REMOTE HEARTBEAT/);
  assert.match(markup, /Cloud heartbeat stale · roles marked offline/);
  assert.equal((markup.match(/stale cloud heartbeat/g) ?? []).length, 3);
  assert.doesNotMatch(markup, /127\.0\.0\.1/);
});

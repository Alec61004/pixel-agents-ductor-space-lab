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
  assert.match(markup, /Ductor Space Lab/);
  assert.match(markup, /Signals marked derived are presence-based/);
});

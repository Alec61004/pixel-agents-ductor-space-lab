import { useEffect, useMemo, useRef, useState } from 'react';

import { OfficeCanvas } from '../office/components/OfficeCanvas.js';
import { EditorState } from '../office/editor/editorState.js';
import { isE2E } from '../runtime.js';
import type { DuctorStatusSnapshot } from './ductorLabModel.js';
import { loadDuctorOfficeAssets } from './ductorOfficeAssets.js';
import {
  createDuctorOfficeRuntime,
  DUCTOR_AGENT_IDS,
  DUCTOR_ROLE_PRESENTATION,
  type DuctorAgentObservation,
  DuctorOfficeRuntime,
} from './ductorOfficeRuntime.js';
import { StarshipLab } from './StarshipLab.js';

export interface DuctorLabProps {
  snapshot: DuctorStatusSnapshot;
  /** Dependency injection for deterministic SSR/unit tests; production loads canonical assets. */
  initialRuntime?: DuctorOfficeRuntime;
}

declare global {
  interface Window {
    __ductorLabTestHooks?: {
      observeAgents: () => DuctorAgentObservation[];
      runtimeStartedAt: number;
    };
  }
}

const NOOP = (): void => undefined;

function formatSignalTime(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp));
}

export function DuctorCrewHud({ snapshot }: { snapshot: DuctorStatusSnapshot }) {
  return (
    <section className="ductor-crew-hud" aria-label="Ductor crew status" role="list">
      {snapshot.roles.map((role) => {
        const presentation = DUCTOR_ROLE_PRESENTATION[role.name];
        return (
          <article
            key={role.name}
            className="ductor-agent-hud"
            data-ductor-agent={role.name}
            data-state={role.state}
            role="listitem"
            style={{ '--ductor-role-color': presentation.color } as React.CSSProperties}
            aria-label={`${role.name}, ${presentation.duty}, ${role.state}`}
          >
            <span className="ductor-agent-hud__signal" aria-hidden="true" />
            <span className="ductor-agent-hud__identity">
              <strong>{role.name}</strong>
              <span>{presentation.duty}</span>
            </span>
            <span className="ductor-agent-hud__activity">
              <strong>{role.state}</strong>
              <span>
                {role.taskLabel ??
                  (role.derived ? 'Presence detected · activity unobserved' : 'No task reported')}
              </span>
            </span>
            <span className="ductor-agent-hud__meta">
              <span>
                {role.provenance?.replaceAll('-', ' ') ?? (role.derived ? 'derived' : 'reported')}
              </span>
              <time dateTime={role.updatedAt}>{formatSignalTime(role.updatedAt)}</time>
            </span>
          </article>
        );
      })}
    </section>
  );
}

export function DuctorEngineSurface({
  runtime,
  snapshot,
}: {
  runtime: DuctorOfficeRuntime;
  snapshot: DuctorStatusSnapshot;
}) {
  const editorState = useMemo(() => new EditorState(), []);
  const panRef = useRef({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(2);

  useEffect(() => runtime.applySnapshot(snapshot), [runtime, snapshot]);

  useEffect(() => {
    if (!isE2E) return;
    const hooks = {
      observeAgents: () => runtime.observeAgents(),
      runtimeStartedAt: performance.now(),
    };
    window.__ductorLabTestHooks = hooks;
    return () => {
      if (window.__ductorLabTestHooks === hooks) delete window.__ductorLabTestHooks;
    };
  }, [runtime]);

  return (
    <main className="ductor-lab" aria-label="Ductor Space Lab agent monitor">
      <div className="ductor-lab__veil" aria-hidden="true" />

      <header className="ductor-lab__header">
        <div>
          <p className="ductor-lab__eyebrow">
            {snapshot.publishedAt ? 'PRIVATE // REMOTE HEARTBEAT' : 'PRIVATE // LOCAL SIGNAL ARRAY'}
          </p>
          <h1>Ductor Space Lab</h1>
        </div>
        <div className="ductor-lab__link" role="status" aria-live="polite">
          <span className="ductor-lab__link-dot" aria-hidden="true" />
          {snapshot.publishedAt
            ? snapshot.stale
              ? 'Cloud heartbeat stale · agents inactive'
              : 'Protected remote · live engine'
            : '127.0.0.1 · LIVE ENGINE'}
        </div>
      </header>

      <section
        className="ductor-lab__engine"
        data-ductor-engine-surface="true"
        aria-label="Animated Ductor Space Lab floor"
      >
        <OfficeCanvas
          officeState={runtime.officeState}
          onClick={NOOP}
          isEditMode={false}
          editorState={editorState}
          onEditorTileAction={NOOP}
          onEditorEraseAction={NOOP}
          onEditorSelectionChange={NOOP}
          onDeleteSelected={NOOP}
          onRotateSelected={NOOP}
          onDragMove={NOOP}
          editorTick={0}
          zoom={zoom}
          onZoomChange={setZoom}
          panRef={panRef}
          showAreas={true}
          activeAreaLabel={null}
          readOnly={true}
        />
      </section>

      <DuctorCrewHud snapshot={snapshot} />
      <footer className="ductor-lab__footer">
        Signals marked derived are presence-based; no message, prompt, token, or task result is
        read.
      </footer>
    </main>
  );
}

export function DuctorLab({ snapshot }: DuctorLabProps) {
  return <StarshipLab snapshot={snapshot} />;
}

export { DUCTOR_AGENT_IDS, StarshipLab };

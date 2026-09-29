import { useMemo, useState, type CSSProperties } from 'react';

import type { DuctorRoleName, DuctorStatusSnapshot } from './ductorLabModel.js';
import { type ObservationTab, observationColor } from './agentObservation.js';

interface AgentObservationPanelProps {
  role: DuctorRoleName;
  snapshot?: DuctorStatusSnapshot;
  onSelectRole(role: DuctorRoleName): void;
  onClose(): void;
}

const ALL_ROLES: DuctorRoleName[] = ['Alec', 'Kevin', 'Benjamin'];

const WORKSTATION: Record<
  DuctorRoleName,
  { label: string; specialty: string; project: string; fallbackOperation: string }
> = {
  Alec: {
    label: 'COMMAND CONSOLE',
    specialty: 'COORDINATION BRIDGE',
    project: 'command-bridge',
    fallbackOperation: 'Coordinating crew actions',
  },
  Kevin: {
    label: 'STAR MAP CONSOLE',
    specialty: 'ASTRO DATA ANALYSIS',
    project: 'star-mapper',
    fallbackOperation: 'Processing star-map data',
  },
  Benjamin: {
    label: 'QA SCANNER CONSOLE',
    specialty: 'VALIDATION & REVIEW',
    project: 'qa-scanner',
    fallbackOperation: 'Verifying the active build',
  },
};

function tabTitle(tab: ObservationTab): string {
  return tab === 'code' ? 'CODE' : tab === 'terminal' ? 'TERMINAL' : 'BROWSER';
}

function stateProgress(state: string | undefined): number {
  if (state === 'working') return 66;
  if (state === 'review') return 80;
  if (state === 'waiting') return 35;
  if (state === 'blocked') return 15;
  return 0;
}

function stateLabel(state: string | undefined): string {
  return state ? state.toUpperCase() : 'OFFLINE';
}

function formatClock(value: string | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

/**
 * A workstation is a flex sibling of the Lab Map, rather than an overlay.
 * Its chrome follows the approved sci-fi workbench reference while code,
 * terminal, and browser contents appear only after the agent reports them.
 */
export function AgentObservationPanel({
  role,
  snapshot,
  onSelectRole,
  onClose,
}: AgentObservationPanelProps) {
  const [tab, setTab] = useState<ObservationTab>('code');
  const [viewAll, setViewAll] = useState(false);
  const selected = snapshot?.roles.find((entry) => entry.name === role);
  // The live heartbeat stays status-only until the next audited mirror transport.
  // This visual shell must never fabricate code, terminal, or browser contents.
  const feed: { title: string; content: string; updatedAt: string } | undefined = undefined;
  const terminalFeed: { content: string } | undefined = undefined;
  const workstation = WORKSTATION[role];
  const accent = observationColor(role);
  const progress = stateProgress(selected?.state);
  const lastSeen = useMemo(() => formatClock(selected?.updatedAt), [selected?.updatedAt]);
  const sourceLabel = feed?.title ?? workstation.project + '/' + tabTitle(tab).toLowerCase();

  return (
    <section className="observation-panel" aria-label={role + ' live workstation'}>
      <style>{`
        .observation-panel { flex: 0 1 62%; min-width: min(690px, 62vw); display: flex; flex-direction: column; overflow: hidden; border: 1px solid rgba(72,224,255,.45); border-radius: 14px; background: linear-gradient(145deg, #061521, #020910 66%); color: #d9edf4; font-family: 'JetBrains Mono', ui-monospace, monospace; box-shadow: inset 0 0 32px rgba(20,201,255,.07), 0 0 28px rgba(0,0,0,.5); }
        .observation-head { min-height: 69px; display: flex; gap: 13px; align-items: center; padding: 13px 18px; border-bottom: 1px solid rgba(103,235,255,.28); background: linear-gradient(90deg, rgba(8,31,45,.97), rgba(5,15,24,.94)); }
        .observation-title { min-width: 0; flex: 1; }
        .observation-kicker { color: #76aaba; font-size: 9px; letter-spacing: 1.35px; text-transform: uppercase; }
        .observation-name { margin-top: 3px; color: ${accent}; font-size: 18px; font-weight: 800; letter-spacing: 1px; text-shadow: 0 0 14px ${accent}77; }
        .observation-subtitle { margin-top: 4px; color: #8fb1bf; font-size: 9px; letter-spacing: .55px; text-transform: uppercase; }
        .observation-presence { display: inline-flex; align-items: center; gap: 6px; margin-left: 9px; color: #52f6ac; font-size: 9px; vertical-align: middle; }
        .observation-presence::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; box-shadow: 0 0 10px currentColor; }
        .observation-close { flex: 0 0 auto; border: 1px solid rgba(119,245,229,.42); color: #bff9ff; background: rgba(8,31,42,.7); border-radius: 5px; padding: 7px 9px; cursor: pointer; font: inherit; font-size: 9px; letter-spacing: .5px; }
        .observation-roster { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 10px 18px; border-bottom: 1px solid rgba(119,245,229,.18); }
        .observation-agent { min-width: 0; border: 1px solid rgba(132,172,185,.35); background: rgba(5,18,29,.7); color: #b4d5de; padding: 8px 9px; cursor: pointer; text-align: left; font: inherit; }
        .observation-agent.active { border-color: ${accent}; background: linear-gradient(135deg, ${accent}22, rgba(7,20,31,.9)); box-shadow: 0 0 14px ${accent}28, inset 0 -2px ${accent}; color: #fff; }
        .observation-agent strong { display: block; font-size: 10px; letter-spacing: .6px; }
        .observation-agent span { display:block; margin-top: 3px; color: #82a6b0; font-size: 8px; letter-spacing: .45px; }
        .observation-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 11px 18px; }
        .observation-tab { border: 1px solid rgba(132,172,185,.36); color: #a6c9d3; background: rgba(3,16,27,.72); padding: 9px; cursor: pointer; font: inherit; font-size: 10px; letter-spacing: .8px; }
        .observation-tab.active { color: #dfffff; border-color: #2cecff; background: linear-gradient(90deg, rgba(21,192,235,.2), rgba(7,33,49,.65)); box-shadow: inset 0 0 12px rgba(46,236,255,.14), 0 0 10px rgba(46,236,255,.12); }
        .observation-workspace { flex: 1; min-height: 0; display: grid; grid-template-columns: 150px minmax(0, 1fr) 180px; grid-template-rows: minmax(212px, 1fr) 138px; gap: 10px; padding: 0 18px 16px; }
        .observation-panelbox { min-width: 0; min-height: 0; overflow: hidden; border: 1px solid rgba(93,180,202,.32); background: linear-gradient(155deg, rgba(8,29,41,.94), rgba(2,11,18,.95)); }
        .observation-box-head { display: flex; align-items: center; justify-content: space-between; min-height: 31px; padding: 0 10px; border-bottom: 1px solid rgba(93,180,202,.22); color: #9ed5e1; font-size: 9px; letter-spacing: .65px; }
        .observation-tree { grid-row: 1; padding-bottom: 8px; }
        .observation-tree ul { margin: 8px 0 0; padding: 0 11px; list-style: none; color: #9bbcc6; font-size: 9px; line-height: 1.95; }
        .observation-tree li { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .observation-tree .selected { padding: 2px 5px; margin: 1px -5px; color: #dbfbff; background: rgba(34,198,237,.12); border-left: 2px solid #2cecff; }
        .observation-code { grid-row: 1; display: flex; flex-direction: column; }
        .observation-content { margin: 0; min-height: 0; flex: 1; overflow: auto; padding: 13px; color: #d8f4f4; font: 10px/1.62 'JetBrains Mono', ui-monospace, monospace; white-space: pre; tab-size: 2; background: repeating-linear-gradient(0deg, rgba(84,186,205,.028) 0 1px, transparent 1px 4px); }
        .observation-empty { display: grid; place-items: center; min-height: 0; flex: 1; padding: 22px; text-align: center; color: #8caab5; font-size: 10px; line-height: 1.7; background: repeating-linear-gradient(0deg, rgba(84,186,205,.025) 0 1px, transparent 1px 4px); }
        .observation-empty strong { display: block; color: #d7fbff; font-size: 10px; letter-spacing: .6px; }
        .observation-operation { grid-row: 1 / span 2; padding-bottom: 8px; }
        .observation-operation-body { padding: 12px; }
        .observation-operation-name { color: #e1faff; font-size: 11px; font-weight: 700; line-height: 1.45; }
        .observation-operation-copy { margin-top: 8px; color: #87a9b4; font-size: 9px; line-height: 1.55; }
        .observation-progress { height: 8px; margin: 14px 0 7px; overflow: hidden; border-radius: 99px; background: #082939; }
        .observation-progress > i { display: block; height: 100%; width: ${progress}%; background: linear-gradient(90deg, ${accent}, #20e5ff); box-shadow: 0 0 12px ${accent}; transition: width .3s ease; }
        .observation-progress-label { display: flex; justify-content: space-between; color: #7bb8c8; font-size: 9px; }
        .observation-timeline { margin-top: 16px; border-top: 1px solid rgba(93,180,202,.18); padding-top: 12px; }
        .observation-timeline h3 { margin: 0 0 9px; color: #94d7e4; font-size: 9px; letter-spacing: .9px; }
        .observation-event { position: relative; padding: 0 0 11px 15px; color: #89aeb8; font-size: 9px; line-height: 1.35; }
        .observation-event::before { content: ''; position: absolute; left: 0; top: 3px; width: 7px; height: 7px; border: 2px solid #3bd9ee; border-radius: 50%; background: #061420; }
        .observation-event.done::before { border-color: #49f1a0; background: #49f1a0; box-shadow: 0 0 8px #49f1a0; }
        .observation-event span { display: block; margin-top: 2px; color: #61838f; font-size: 8px; }
        .observation-terminal { grid-column: 1 / span 2; grid-row: 2; display: flex; flex-direction: column; }
        .observation-terminal .observation-content { padding: 10px; font-size: 9px; }
        .observation-footer { display: flex; justify-content: flex-end; padding: 0 18px 16px; }
        .observation-view-all { border: 1px solid #45eaff; color: #74f3ff; background: linear-gradient(135deg, rgba(12,100,131,.25), rgba(3,16,27,.86)); padding: 10px 14px; min-width: 145px; cursor: pointer; font: inherit; font-size: 10px; font-weight: 800; letter-spacing: .7px; box-shadow: inset 0 0 12px rgba(42,225,255,.1); }
        .observation-all { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; padding: 0 18px 16px; }
        .observation-all-card { min-height: 102px; border: 1px solid rgba(105,184,202,.35); background: linear-gradient(145deg, rgba(7,28,40,.95), rgba(2,12,20,.96)); padding: 13px; color: inherit; cursor: pointer; text-align: left; font: inherit; }
        .observation-all-card strong { display: block; color: var(--agent-color); font-size: 11px; letter-spacing: .6px; }
        .observation-all-card span { display:block; margin-top: 8px; color:#a1c1cb; font-size: 9px; line-height:1.5; }
        @media (max-width: 1150px) { .observation-panel { min-width: 56vw; } .observation-workspace { grid-template-columns: 132px minmax(0, 1fr); } .observation-operation { grid-column: 1 / span 2; grid-row: auto; } .observation-terminal { grid-column: 1 / span 2; grid-row: auto; } }
        @media (max-width: 760px) { .observation-panel { flex: 0 0 auto; min-width: 0; width: 100%; } .observation-head { align-items: flex-start; } .observation-roster, .observation-tabs, .observation-all { grid-template-columns: 1fr; } .observation-workspace { display: flex; flex-direction: column; } .observation-tree, .observation-code, .observation-operation, .observation-terminal { flex: 0 0 230px; } .observation-operation { flex-basis: auto; } }
      `}</style>

      <div className="observation-head">
        <div className="observation-title">
          <div className="observation-kicker">{workstation.label}</div>
          <div className="observation-name">
            {role.toUpperCase()} · LIVE SESSION
            <span className="observation-presence">{selected?.presence === 'online' ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
          <div className="observation-subtitle">{workstation.specialty} · {selected?.taskLabel ?? 'Awaiting a reported operation'}</div>
        </div>
        <button type="button" className="observation-close" onClick={onClose}>RETURN TO LAB</button>
      </div>

      <div className="observation-roster" aria-label="Choose an agent workstation">
        {ALL_ROLES.map((name) => {
          const entry = snapshot?.roles.find((item) => item.name === name);
          return (
            <button key={name} type="button" className={'observation-agent ' + (name === role ? 'active' : '')} onClick={() => onSelectRole(name)}>
              <strong>{name.toUpperCase()}</strong>
              <span>{stateLabel(entry?.state)}</span>
            </button>
          );
        })}
      </div>

      {viewAll ? (
        <div className="observation-all">
          {ALL_ROLES.map((name) => {
            const entry = snapshot?.roles.find((item) => item.name === name);
            return (
              <button key={name} type="button" className="observation-all-card" style={{ '--agent-color': observationColor(name) } as CSSProperties} onClick={() => { setViewAll(false); onSelectRole(name); }}>
                <strong>{name.toUpperCase()} · {WORKSTATION[name].label}</strong>
                <span>{stateLabel(entry?.state)} · {entry?.taskLabel ?? 'No reported operation'}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div className="observation-tabs" role="tablist" aria-label="Workstation feed">
            {(['code', 'terminal', 'browser'] as ObservationTab[]).map((name) => (
              <button key={name} type="button" role="tab" aria-selected={tab === name} className={'observation-tab ' + (tab === name ? 'active' : '')} onClick={() => setTab(name)}>
                {tabTitle(name)}
              </button>
            ))}
          </div>

          <div className="observation-workspace">
            <aside className="observation-tree observation-panelbox" aria-label="Project tree">
              <div className="observation-box-head"><span>PROJECT</span></div>
              <ul>
                <li>⌄ {workstation.project}</li>
                <li>&nbsp;&nbsp;⌄ src</li>
                <li>&nbsp;&nbsp;&nbsp;&nbsp;⌄ active</li>
                <li className="selected">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{sourceLabel}</li>
                <li>&nbsp;&nbsp;&nbsp;&nbsp;⌄ modules</li>
                <li>&nbsp;&nbsp;&nbsp;&nbsp;⌄ utils</li>
                <li>&nbsp;&nbsp;› tests</li>
                <li>&nbsp;&nbsp;README.md</li>
              </ul>
            </aside>

            <section className="observation-code observation-panelbox" aria-label={tabTitle(tab) + ' content'}>
              <div className="observation-box-head"><span>{sourceLabel}</span><span>{feed ? 'LIVE' : 'STANDBY'}</span></div>
              {feed ? (
                <pre className="observation-content">{feed.content}</pre>
              ) : (
                <div className="observation-empty"><div><strong>{tabTitle(tab)} FEED NOT SHARED YET</strong>This workstation will show the actual agent feed only after it is explicitly reported.</div></div>
              )}
            </section>

            <aside className="observation-operation observation-panelbox" aria-label="Current operation">
              <div className="observation-box-head"><span>CURRENT OPERATION</span></div>
              <div className="observation-operation-body">
                <div className="observation-operation-name">{selected?.taskLabel ?? workstation.fallbackOperation}</div>
                <div className="observation-operation-copy">Reported state: {stateLabel(selected?.state)}. No inferred work details are shown.</div>
                <div className="observation-progress"><i /></div>
                <div className="observation-progress-label"><span>ACTIVITY</span><b>{progress}%</b></div>
                <div className="observation-timeline">
                  <h3>EVENT TIMELINE</h3>
                  <div className="observation-event done">Last station signal<span>{lastSeen}</span></div>
                  <div className={'observation-event ' + (feed ? 'done' : '')}>{feed ? tabTitle(tab) + ' feed updated' : 'Awaiting verified feed'}<span>{feed ? formatClock(feed.updatedAt) : '—'}</span></div>
                  <div className="observation-event">Current state: {stateLabel(selected?.state)}<span>{selected?.provenance ?? 'No cloud evidence'}</span></div>
                </div>
              </div>
            </aside>

            <section className="observation-terminal observation-panelbox" aria-label="Terminal output">
              <div className="observation-box-head"><span>TERMINAL · PROCESS OUTPUT</span><span>{terminalFeed ? 'LIVE' : 'STANDBY'}</span></div>
              {terminalFeed ? (
                <pre className="observation-content">{terminalFeed.content}</pre>
              ) : (
                <div className="observation-empty"><div><strong>NO TERMINAL FEED</strong>Terminal output appears here only when the agent explicitly shares it.</div></div>
              )}
            </section>
          </div>
        </>
      )}

      <div className="observation-footer">
        <button type="button" className="observation-view-all" onClick={() => setViewAll((value) => !value)}>
          {viewAll ? 'BACK TO SESSION' : 'VIEW ALL 3'}
        </button>
      </div>
    </section>
  );
}

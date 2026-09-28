import { useMemo, useState, type CSSProperties } from 'react';

import type { DuctorRoleName, DuctorStatusSnapshot } from './ductorLabModel.js';
import {
  type ObservationTab,
  observationColor,
} from './agentObservation.js';

interface AgentObservationPanelProps {
  role: DuctorRoleName;
  snapshot?: DuctorStatusSnapshot;
  onSelectRole(role: DuctorRoleName): void;
  onClose(): void;
}

const ALL_ROLES: DuctorRoleName[] = ['Alec', 'Kevin', 'Benjamin'];

function activityLabel(role: DuctorRoleName): string {
  if (role === 'Alec') return 'Command console';
  if (role === 'Kevin') return 'Star-map navigation';
  return 'QA scanner';
}

function tabTitle(tab: ObservationTab): string {
  if (tab === 'code') return 'CODE';
  if (tab === 'terminal') return 'TERMINAL';
  return 'BROWSER';
}

/**
 * Full-size inspection surface. It deliberately renders only evidence that is
 * present in the cloud snapshot. Code, terminal and browser panes show their
 * live feed only once a collector publishes it; the UI never invents activity.
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
  const color = observationColor(role);
  const lastSeen = useMemo(() => {
    if (!selected?.updatedAt) return 'No signal yet';
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(new Date(selected.updatedAt));
  }, [selected?.updatedAt]);

  return (
    <section className="observation-panel" aria-label={`${role} live observation`}>
      <style>{`
        .observation-panel { flex: 0 1 62%; min-width: min(690px, 62vw); display: flex; flex-direction: column; overflow: hidden; border-left: 1px solid rgba(119,245,229,.36); background: linear-gradient(145deg, #071621, #02090f 68%); color: #d9edf4; font-family: 'JetBrains Mono', monospace; }
        .observation-head { display: flex; gap: 14px; align-items: center; padding: 15px 18px; border-bottom: 1px solid rgba(119,245,229,.26); background: rgba(5,21,31,.82); }
        .observation-title { min-width: 0; flex: 1; }
        .observation-kicker { color: #8daab6; font-size: 9px; letter-spacing: 1.4px; text-transform: uppercase; }
        .observation-name { margin-top: 4px; color: ${color}; font-size: 18px; letter-spacing: 1.1px; text-shadow: 0 0 14px ${color}66; }
        .observation-subtitle { margin-top: 4px; color: #9bb8c3; font-size: 10px; }
        .observation-close { border: 1px solid rgba(119,245,229,.42); color: #bff9ff; background: rgba(8,31,42,.7); border-radius: 5px; padding: 7px 10px; cursor: pointer; font: inherit; font-size: 10px; }
        .observation-switcher { display: flex; gap: 6px; padding: 10px 18px; border-bottom: 1px solid rgba(119,245,229,.17); }
        .observation-agent, .observation-tab, .observation-view-all { border: 1px solid rgba(132,172,185,.28); color: #9fc4cf; background: rgba(255,255,255,.025); padding: 7px 10px; cursor: pointer; font: inherit; font-size: 10px; letter-spacing: .4px; }
        .observation-agent.active { color: #fff; border-color: ${color}; box-shadow: inset 0 -2px ${color}77; }
        .observation-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 12px 18px; }
        .observation-tab.active { color: #61e8ff; border-color: #61e8ff; background: rgba(55,204,232,.1); box-shadow: 0 0 14px rgba(55,204,232,.10); }
        .observation-body { min-height: 0; flex: 1; display: grid; grid-template-columns: minmax(0, 1fr) 190px; gap: 12px; padding: 0 18px 18px; }
        .observation-feed, .observation-meta { min-height: 0; border: 1px solid rgba(109,167,182,.27); background: linear-gradient(155deg, rgba(9,31,42,.93), rgba(3,12,19,.92)); }
        .observation-feed { display: flex; flex-direction: column; }
        .observation-feed-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid rgba(109,167,182,.22); color: #a9d4df; font-size: 10px; }
        .observation-live-dot { width: 7px; height: 7px; border-radius: 50%; background: ${color}; box-shadow: 0 0 9px ${color}; }
        .observation-empty { display: grid; place-items: center; flex: 1; padding: 30px; text-align: center; color: #8ba9b5; font-size: 11px; line-height: 1.7; background: repeating-linear-gradient(0deg, rgba(84,186,205,.025) 0 1px, transparent 1px 4px); }
        .observation-empty strong { color: #d5f4f8; }
        .observation-meta { padding: 12px; overflow: auto; }
        .observation-meta h3 { margin: 0 0 14px; color: #9fdfea; font-size: 10px; letter-spacing: 1px; }
        .observation-metric { padding: 10px 0; border-bottom: 1px solid rgba(109,167,182,.15); }
        .observation-metric span { display: block; color: #7798a4; font-size: 8px; letter-spacing: .8px; }
        .observation-metric b { display: block; color: #e4f7f8; font-size: 11px; margin-top: 4px; overflow-wrap: anywhere; }
        .observation-footer { display: flex; justify-content: flex-end; padding: 0 18px 18px; }
        .observation-view-all { border-color: #5ce1ff; color: #5ce1ff; min-width: 140px; }
        .observation-all { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 0 18px 18px; }
        .observation-all-card { border: 1px solid rgba(109,167,182,.28); padding: 12px; background: rgba(7,26,36,.72); cursor: pointer; text-align: left; color: inherit; font: inherit; }
        .observation-all-card strong { display:block; color: var(--agent-color); font-size: 11px; }
        .observation-all-card span { display:block; margin-top: 6px; color:#99b4be; font-size: 9px; line-height:1.45; }
        @media (max-width: 1050px) { .observation-panel { min-width: 56vw; } .observation-body { grid-template-columns: 1fr; } .observation-meta { display:none; } }
        @media (max-width: 760px) { .observation-panel { flex: 0 0 auto; min-width:0; width:100%; } .observation-all { grid-template-columns: 1fr; } }
      `}</style>

      <div className="observation-head">
        <div className="observation-title">
          <div className="observation-kicker">Live observation · {activityLabel(role)}</div>
          <div className="observation-name">{role.toUpperCase()} · SESSION</div>
          <div className="observation-subtitle">{selected?.taskLabel ?? 'No active task has been reported.'}</div>
        </div>
        <button type="button" className="observation-close" onClick={onClose}>RETURN TO LAB</button>
      </div>

      <div className="observation-switcher" aria-label="Choose an agent session">
        {ALL_ROLES.map((name) => <button key={name} type="button" className={`observation-agent ${name === role ? 'active' : ''}`} onClick={() => onSelectRole(name)}>{name}</button>)}
      </div>

      {viewAll ? (
        <div className="observation-all">
          {ALL_ROLES.map((name) => {
            const entry = snapshot?.roles.find((item) => item.name === name);
            return <button key={name} type="button" className="observation-all-card" style={{ '--agent-color': observationColor(name) } as CSSProperties} onClick={() => { setViewAll(false); onSelectRole(name); }}>
              <strong>{name}</strong><span>{entry?.state ?? 'offline'} · {entry?.taskLabel ?? 'No reported task'}</span>
            </button>;
          })}
        </div>
      ) : (
        <>
          <div className="observation-tabs" role="tablist" aria-label="Session feed">
            {(['code', 'terminal', 'browser'] as ObservationTab[]).map((name) => <button key={name} type="button" role="tab" aria-selected={tab === name} className={`observation-tab ${tab === name ? 'active' : ''}`} onClick={() => setTab(name)}>{tabTitle(name)}</button>)}
          </div>
          <div className="observation-body">
            <div className="observation-feed">
              <div className="observation-feed-head"><span>{tabTitle(tab)} FEED</span><span className="observation-live-dot" /></div>
              <div className="observation-empty"><div><strong>Waiting for the {tabTitle(tab).toLowerCase()} mirror.</strong><br />The current heartbeat truthfully publishes presence, state and task only. The session bridge will populate this pane when it receives a real agent event.</div></div>
            </div>
            <aside className="observation-meta">
              <h3>SESSION EVIDENCE</h3>
              <div className="observation-metric"><span>STATE</span><b>{selected?.state?.toUpperCase() ?? 'OFFLINE'}</b></div>
              <div className="observation-metric"><span>LAST SIGNAL</span><b>{lastSeen}</b></div>
              <div className="observation-metric"><span>PROVENANCE</span><b>{selected?.provenance ?? 'No cloud evidence'}</b></div>
            </aside>
          </div>
        </>
      )}
      <div className="observation-footer"><button type="button" className="observation-view-all" onClick={() => setViewAll((value) => !value)}>{viewAll ? 'BACK TO SESSION' : 'VIEW ALL 3'}</button></div>
    </section>
  );
}

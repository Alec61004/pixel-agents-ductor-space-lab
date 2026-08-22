import type { CSSProperties } from 'react';

import { createDuctorRoleCards, type DuctorStatusSnapshot } from './ductorLabModel.js';

export interface DuctorLabProps {
  snapshot: DuctorStatusSnapshot;
}

function formatSignalTime(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp));
}

export function DuctorLab({ snapshot }: DuctorLabProps) {
  const cards = createDuctorRoleCards(snapshot);
  const assetBase = `${import.meta.env.BASE_URL}assets/`;

  return (
    <main className="ductor-lab" aria-label="Ductor Space Lab agent monitor">
      <img
        className="ductor-lab__scene"
        src={`${assetBase}themes/ductor-space-lab/space-lab.webp`}
        alt=""
        aria-hidden="true"
      />
      <div className="ductor-lab__veil" aria-hidden="true" />

      <header className="ductor-lab__header">
        <div>
          <p className="ductor-lab__eyebrow">PRIVATE // LOCAL SIGNAL ARRAY</p>
          <h1>Ductor Space Lab</h1>
        </div>
        <div className="ductor-lab__link" role="status" aria-live="polite">
          <span className="ductor-lab__link-dot" />
          127.0.0.1 · READ ONLY
        </div>
      </header>

      <section className="ductor-lab__stations" aria-label="Ductor crew stations">
        {cards.map((card) => {
          const style = {
            '--ductor-role-color': card.color,
            '--ductor-sprite-url': `url('${assetBase}characters/char_${card.palette.toString()}.png')`,
          } as CSSProperties;
          return (
            <article
              key={card.name}
              className={`ductor-station ductor-station--${card.station}`}
              style={style}
              data-role-card={card.name}
              data-state={card.state}
              aria-label={`${card.name}, ${card.duty}, ${card.state}`}
            >
              <div className="ductor-station__scanline" aria-hidden="true" />
              <div className="ductor-station__identity">
                <div
                  className={`ductor-character ductor-character--${card.state}`}
                  aria-hidden="true"
                />
                <div>
                  <span className="ductor-station__duty">{card.duty}</span>
                  <h2>{card.name}</h2>
                </div>
              </div>

              <div className="ductor-station__state">
                <span className="ductor-station__state-dot" aria-hidden="true" />
                {card.state}
              </div>

              <p className="ductor-station__task">
                {card.taskLabel ??
                  (card.derived ? 'Presence detected · activity unobserved' : 'No task label')}
              </p>
              <div className="ductor-station__meta">
                <span>{card.presence}</span>
                <span>{card.derived ? 'derived' : 'reported'}</span>
                <time dateTime={card.updatedAt}>{formatSignalTime(card.updatedAt)}</time>
              </div>
            </article>
          );
        })}
      </section>

      <footer className="ductor-lab__footer">
        Signals marked derived are presence-based; no message, prompt, token, or task result is
        read.
      </footer>
    </main>
  );
}

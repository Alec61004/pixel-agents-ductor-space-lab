import { useEffect } from 'react';

export function RuntimeRoot() {
  useEffect(() => {
    window.location.replace('/v7-exact.html');
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: '#000',
        color: '#9fe',
        fontFamily: 'monospace',
      }}
    >
      Loading V7 exact…
    </div>
  );
}

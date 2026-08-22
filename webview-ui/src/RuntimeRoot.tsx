import { lazy, Suspense } from 'react';

import { DuctorLab } from './ductor/DuctorLab.js';
import { selectRuntimeSurface } from './ductor/ductorLabModel.js';
import { useDuctorLabStatus } from './ductor/useDuctorLabStatus.js';

const OfficeApp = lazy(() => import('./App.tsx'));

export function RuntimeRoot() {
  const ductorStatus = useDuctorLabStatus();
  const surface = selectRuntimeSurface(ductorStatus);

  if (surface === 'checking') {
    return <div className="w-full h-full flex items-center justify-center">Loading...</div>;
  }
  if (surface === 'ductor-space-lab' && ductorStatus) {
    return <DuctorLab snapshot={ductorStatus} />;
  }
  return (
    <Suspense
      fallback={<div className="w-full h-full flex items-center justify-center">Loading...</div>}
    >
      <OfficeApp />
    </Suspense>
  );
}

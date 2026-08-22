import { createBlobCloudStatusStore } from '../_lib/ductorBlobStore.js';
import { createCloudStatusHandler } from '../_lib/ductorHandlers.js';

const store = createBlobCloudStatusStore();

export const GET = createCloudStatusHandler({ store });

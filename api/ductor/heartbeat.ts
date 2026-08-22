import { createBlobCloudStatusStore } from '../_lib/ductorBlobStore.js';
import { createCloudHeartbeatHandler } from '../_lib/ductorHandlers.js';

const store = createBlobCloudStatusStore();

export const POST = createCloudHeartbeatHandler({
  secret: process.env['DUCTOR_CLOUD_WRITE_SECRET'],
  store,
});

import { createCloudHeartbeatHandler } from '../_lib/ductorHandlers.js';
import { createRedisCloudStatusStore } from '../_lib/ductorRedisStore.js';

const store = createRedisCloudStatusStore();

export const POST = createCloudHeartbeatHandler({
  secret: process.env['DUCTOR_CLOUD_WRITE_SECRET'],
  store,
});

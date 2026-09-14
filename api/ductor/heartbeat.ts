import { createRedisCloudStatusStore } from '../_lib/ductorRedisStore.js';
import { createCloudHeartbeatHandler } from '../_lib/ductorHandlers.js';

const store = createRedisCloudStatusStore();

export const POST = createCloudHeartbeatHandler({
  secret: process.env['DUCTOR_CLOUD_WRITE_SECRET'],
  store,
});

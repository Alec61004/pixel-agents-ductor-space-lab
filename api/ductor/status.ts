import { createRedisCloudStatusStore } from '../_lib/ductorRedisStore.js';
import { createCloudStatusHandler } from '../_lib/ductorHandlers.js';

const store = createRedisCloudStatusStore();

export const GET = createCloudStatusHandler({ store });

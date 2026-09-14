import { createCloudStatusHandler } from '../_lib/ductorHandlers.js';
import { createRedisCloudStatusStore } from '../_lib/ductorRedisStore.js';

const store = createRedisCloudStatusStore();

export const GET = createCloudStatusHandler({ store });

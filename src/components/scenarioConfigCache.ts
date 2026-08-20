import type { JobConfigResponse } from '../types/api';

const MAX_CACHE_SIZE = 100;

export const configCache = new Map<string, JobConfigResponse>();

export function cacheSet(key: string, value: JobConfigResponse): void {
  if (configCache.size >= MAX_CACHE_SIZE) {
    const oldest = configCache.keys().next().value!;
    configCache.delete(oldest);
  }
  configCache.set(key, value);
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();
const MAX_CACHE_SIZE = 20;

const REFRESH_BUFFER_MS = 10 * 60 * 1000;

function evictExpired(): void {
  const now = Date.now();
  for (const [key, entry] of tokenCache) {
    if (now >= entry.expiresAt) tokenCache.delete(key);
  }
}

export function getCachedToken(orgId: string): string | null {
  const cached = tokenCache.get(orgId);
  if (!cached) return null;
  if (Date.now() >= cached.expiresAt - REFRESH_BUFFER_MS) {
    tokenCache.delete(orgId);
    return null;
  }
  return cached.accessToken;
}

export function setCachedToken(orgId: string, accessToken: string, expiresIn: number): void {
  evictExpired();
  if (tokenCache.size >= MAX_CACHE_SIZE && !tokenCache.has(orgId)) {
    const firstKey = tokenCache.keys().next().value;
    if (firstKey) tokenCache.delete(firstKey);
  }
  tokenCache.set(orgId, {
    accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
  });
}

export function clearTokenCache(orgId?: string): void {
  if (orgId) {
    tokenCache.delete(orgId);
  } else {
    tokenCache.clear();
  }
}

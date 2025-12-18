const CACHE_TTL_BUFFER_MS = 5_000;

const buildKey = (path: string, expiresIn: number) => `${path}::${expiresIn}`;

type CacheEntry = {
  signedUrl: string | null;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

export async function getAlertSoundSignedUrl(path: string, expiresIn = 60): Promise<string | null> {
  if (!path) return null;
  const now = Date.now();
  const cacheKey = buildKey(path, expiresIn);
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt - CACHE_TTL_BUFFER_MS > now) {
    console.debug('[AlertSound] Using cached signed URL', { path, expiresIn });
    return cached.signedUrl;
  }

  try {
    console.debug('[AlertSound] Fetching signed URL', { path, expiresIn });
    const response = await fetch('/api/alert-sounds/signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, expiresIn }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.warn('[AlertSound] Signed URL fetch failed', response.status, text);
      cache.delete(cacheKey);
      return null;
    }

    const data = await response.json().catch(() => null);
    if (!data) {
      cache.delete(cacheKey);
      console.warn('[AlertSound] Signed URL response parse failed');
      return null;
    }
    const signedUrl = typeof data?.signedUrl === 'string' ? data.signedUrl : null;
    console.debug('[AlertSound] Signed URL response', { path, expiresIn, hasUrl: Boolean(signedUrl) });
    const ttl = typeof data?.expiresIn === 'number' ? data.expiresIn : expiresIn;
    if (signedUrl) {
      cache.set(cacheKey, {
        signedUrl,
        expiresAt: now + ttl * 1000,
      });
    } else {
      cache.delete(cacheKey);
    }
    return signedUrl;
  } catch (error) {
    console.warn('[AlertSound] Signed URL fetch exception', error);
    return null;
  }
}

export function clearAlertSoundCache(path?: string) {
  if (typeof path === 'string') {
    for (const key of cache.keys()) {
      if (key.startsWith(`${path}::`)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
}

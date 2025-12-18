export interface FetchWithRetryOptions extends RequestInit {
  maxRetries?: number;
  retryDelay?: number;
  retryOn?: number[];
  skipAuthRefresh?: boolean;
}

// Track if we're already refreshing the session to prevent multiple refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  // If we're already refreshing, return the existing promise
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshResponse = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      if (!refreshResponse.ok) {
        console.error('Session refresh failed:', refreshResponse.status, refreshResponse.statusText);
        // If refresh fails, clear the session
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error refreshing session:', error);
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    retryOn = [401, 403, 408, 429, 500, 502, 503, 504],
    skipAuthRefresh = false,
    ...init
  } = options;

  let lastError: Error | null = null;
  let attempt = 0;
  let shouldRefreshSession = false;

  while (attempt <= maxRetries) {
    try {
      // If we need to refresh the session and it's not skipped
      if (shouldRefreshSession && !skipAuthRefresh) {
        const refreshSuccess = await refreshSession();
        if (!refreshSuccess) {
          // If refresh failed, redirect to login
          if (typeof window !== 'undefined') {
            window.location.href = '/login?session_expired=1';
          }
          throw new Error('Session expired. Please log in again.');
        }
        shouldRefreshSession = false; // Reset the flag after refresh
      }

      const response = await fetch(input, {
        ...init,
        credentials: 'include', // Always include credentials
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          ...(init.headers || {}),
        },
      });

      // Handle 401 Unauthorized - try to refresh session once
      if (response.status === 401 && !skipAuthRefresh && !shouldRefreshSession) {
        shouldRefreshSession = true;
        attempt++;
        continue;
      }

      // If the response is successful or not in the retry list, return it
      if (response.ok || !retryOn.includes(response.status)) {
        return response;
      }

      // If we should retry, wait for the delay and try again
      if (attempt < maxRetries) {
        const delay = retryDelay * Math.pow(2, attempt) + Math.random() * 100;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } catch (error) {
      lastError = error as Error;
      if (attempt >= maxRetries) break;
      
      const delay = retryDelay * Math.pow(2, attempt) + Math.random() * 100;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    
    attempt++;
  }

  // If we have a last error, throw it
  if (lastError) {
    throw lastError;
  }

  throw new Error(`Failed to fetch after ${maxRetries} attempts`);
}

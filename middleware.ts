import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { securityHeadersMiddleware } from './middleware/security-headers';
import { rateLimitMiddleware } from './middleware/rate-limiter';
import { authSessionMiddleware } from './middleware/auth-session';

// This function can be marked `async` if using `await` inside
export async function middleware(request: NextRequest) {
  // Start with security headers on a base response
  let response = securityHeadersMiddleware(request);
  
  // Apply rate limiting to API routes
  if (request.nextUrl.pathname.startsWith('/api')) {
    const rateLimitedResponse = await rateLimitMiddleware(request);
    if (rateLimitedResponse.status === 429) {
      return rateLimitedResponse;
    }
    // Merge rate limit headers into our response
    ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'].forEach((h) => {
      const val = rateLimitedResponse.headers.get(h);
      if (val) response.headers.set(h, val);
    });
  }

  // Refresh Supabase auth session cookies and gate protected routes
  response = await authSessionMiddleware(request, response);
  
  return response;
}
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};

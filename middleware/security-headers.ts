import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const scriptSrc = process.env.NODE_ENV === 'production'
  ? "script-src 'self' 'unsafe-inline' https://unpkg.com"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self' https://*.supabase.co",
  scriptSrc,
  "style-src 'self' 'unsafe-inline' https://unpkg.com",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://unpkg.com https://*.supabase.co",
  "font-src 'self' https://unpkg.com data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.tile.openstreetmap.org",
  "frame-src 'self' https://www.openstreetmap.org",
  "media-src 'self' data: blob: https://*.supabase.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=*, payment=()',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
};

const EXCLUDED_PATHS: string[] = [
  '/api/auth', 
  '/auth',
  '/api/geocode', 
  '/api/users', 
  '/api/reports', 
  '/api/barangays', 
  '/api/locations', 
];

export function securityHeadersMiddleware(request: NextRequest) {
  const path = new URL(request.url).pathname;

  // Skip middleware for excluded paths
  if (EXCLUDED_PATHS.some(p => path.startsWith(p))) {
    return NextResponse.next();
  }

  // Get the response
  const response = NextResponse.next();

  // Add security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Add HSTS header in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
  }

  return response;
}

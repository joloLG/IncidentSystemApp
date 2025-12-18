"use client"

import { supabase } from "@/lib/supabase"

/**
 * Robust sign-out that clears the server-side active admin session lock
 * even if the page navigates immediately after calling this function.
 */
export async function robustSignOut(): Promise<void> {
  try {
    // Capture current session before sign-out
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
      try {
        // Ask API to clear the active session lock for this session.
        // keepalive ensures the request can finish during page unload.
        await fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'SIGNED_OUT', session }),
          keepalive: true,
        })
      } catch {}
    }

    // Sign out locally (scope local works well with SSR)
    try { await supabase.auth.signOut({ scope: 'local' } as any) } catch {}
    try { await supabase.auth.signOut() } catch {}

    // Best-effort local cleanup
    try { localStorage.removeItem('mdrrmo_user') } catch {}
    try { localStorage.removeItem('mdrrmo_login_error') } catch {}
    try { localStorage.removeItem('supabase.auth.token') } catch {}
  } catch (e) {
    // Non-fatal; ensure UI can still proceed
    console.warn('robustSignOut warning:', e)
  }
}

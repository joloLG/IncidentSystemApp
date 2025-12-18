"use client"

import { useEffect, useRef } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export function SupabaseListener() {
  const supabase = createClientComponentClient()
  const lastSessionRef = useRef<any | null>(null)

  useEffect(() => {
    // 1) On mount, sync current session to cookies if present (handles pre-existing localStorage sessions)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        lastSessionRef.current = session
        try {
          const res = await fetch('/api/auth/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'INITIAL_SESSION', session })
          })
          if (res.status === 409) {
            // Active session conflict: sign out locally and flag error
            try { await supabase.auth.signOut() } catch {}
            try { localStorage.setItem('mdrrmo_login_error', 'active_session_exists') } catch {}
          }
        } catch {}
      }
    })

    // 2) Listen for auth state changes and persist to cookies
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      // Keep a reference to the latest non-null session for SIGNED_OUT cleanup
      if (session) {
        lastSessionRef.current = session
      }

      const payload = { event, session: session ?? lastSessionRef.current }
      fetch('/api/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(async (res) => {
          if (res.status === 409) {
            // Active session conflict: sign out locally and flag error
            try { await supabase.auth.signOut() } catch {}
            try { localStorage.setItem('mdrrmo_login_error', 'active_session_exists') } catch {}
          }
        })
        .catch(() => {})
    })

    return () => {
      try {
        subscription?.subscription?.unsubscribe?.()
      } catch {}
    }
  }, [supabase])

  return null
}


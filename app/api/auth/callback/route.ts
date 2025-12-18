import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { event, session } = await req.json()
    if (event === 'SIGNED_OUT') {
      try { await supabase.auth.signOut() } catch {}
      return NextResponse.json({ ok: true })
    }
    if (session) {
      try { await supabase.auth.setSession(session) } catch {}
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Error in /api/auth/callback:', e)
    return NextResponse.json({ ok: false, error: 'callback_failed' }, { status: 500 })
  }
}

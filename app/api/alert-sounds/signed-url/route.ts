import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

const requestSchema = z.object({
  path: z.string().min(1, 'path is required'),
  expiresIn: z.number().int().positive().max(3600).optional(),
})

const DEFAULT_EXPIRES_IN = 60

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const { path, expiresIn } = requestSchema.parse(json)
    const ttl = expiresIn ?? DEFAULT_EXPIRES_IN

    const { data, error } = await supabaseAdmin
      .storage
      .from('alert_sounds')
      .createSignedUrl(path, ttl)

    if (error) {
      console.error('[alert-sounds] Failed to create signed URL', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!data?.signedUrl) {
      console.warn('[alert-sounds] Signed URL missing from response', { path, ttl, data })
    }

    return NextResponse.json({ signedUrl: data?.signedUrl ?? null, expiresIn: ttl })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: error.errors }, { status: 400 })
    }
    console.error('[alert-sounds] Unexpected error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

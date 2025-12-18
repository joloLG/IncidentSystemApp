import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

let mailerModule: any = null
async function ensureMailerLoaded() {
  if (!mailerModule) {
    try {
      const imported = await import('nodemailer')
      mailerModule = imported?.default || imported
    } catch (error) {
      console.warn('[advisories] Failed to load nodemailer', error)
      mailerModule = null
    }
  }
  return mailerModule
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('user_type, firstName, lastName')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !['admin', 'superadmin'].includes(profile.user_type)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }

    const bodyJson = await req.json()
    const preset = typeof bodyJson?.preset === 'string' ? bodyJson.preset : null
    const title = typeof bodyJson?.title === 'string' ? bodyJson.title.trim() : ''
    const advisoryBody = typeof bodyJson?.body === 'string' ? bodyJson.body.trim() : ''
    const expiresAtRaw = typeof bodyJson?.expiresAt === 'string' ? bodyJson.expiresAt : ''

    if (!title || !advisoryBody) {
      return NextResponse.json({ ok: false, error: 'Title and body are required.' }, { status: 400 })
    }

    if (!expiresAtRaw) {
      return NextResponse.json({ ok: false, error: 'Expiration is required.' }, { status: 400 })
    }

    const expiresDate = new Date(expiresAtRaw)
    if (Number.isNaN(expiresDate.getTime())) {
      return NextResponse.json({ ok: false, error: 'Invalid expiration date.' }, { status: 400 })
    }

    const expiresAt = expiresDate.toISOString()

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('advisories')
      .insert({
        preset,
        title,
        body: advisoryBody,
        expires_at: expiresAt,
        created_by: user.id,
      })
      .select('id, title, body, expires_at, created_at')
      .single()

    if (insertError) {
      console.error('[advisories] insert error:', insertError)
      return NextResponse.json({ ok: false, error: 'Failed to post advisory.' }, { status: 500 })
    }

    const SMTP_HOST = process.env.SMTP_HOST
    const SMTP_PORT = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined
    const SMTP_USER = process.env.SMTP_USER
    const SMTP_PASS = process.env.SMTP_PASS
    const rawFrom = (process.env.SMTP_FROM || '').trim()
    const SMTP_FROM = rawFrom.replace(/^"|"$/g, '') || SMTP_USER

    let emailsSent = 0
    let emailsAttempted = 0
    const emailErrors: { email: string; error: string }[] = []

    if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
      try {
        const mailer = await ensureMailerLoaded()
        if (mailer) {
          const transporter = mailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_PORT === 465,
            auth: { user: SMTP_USER, pass: SMTP_PASS },
          })

          const { data: recipients, error: recipientsError } = await supabaseAdmin
            .from('users')
            .select('email, firstName, lastName')
            .eq('user_type', 'user')
            .not('email', 'is', null)
            .limit(1000)

          if (recipientsError) {
            console.warn('[advisories] recipients fetch error:', recipientsError)
          } else if (recipients && recipients.length > 0) {
            const tasks = recipients.map(async (recipient: any) => {
              const email = recipient?.email?.trim()
              if (!email) return
              emailsAttempted += 1
              const name = [recipient?.firstName, recipient?.lastName].filter(Boolean).join(' ') || 'Citizen'
              const lines = [
                `Hello ${name},`,
                '',
                advisoryBody,
              ]
              if (expiresAt) {
                lines.push('', `This advisory is in effect until ${new Date(expiresAt).toLocaleString()}.`)
              }
              lines.push('', 'Stay safe Bulaneños, -MDRRMO-Bulan.')
              const text = lines.join('\n')

              try {
                await transporter.sendMail({
                  from: SMTP_FROM,
                  to: email,
                  subject: title,
                  text,
                })
                emailsSent += 1
              } catch (mailError) {
                console.warn('[advisories] email send failed for', email, mailError)
                const message = mailError instanceof Error ? mailError.message : String(mailError)
                emailErrors.push({ email, error: message })
              }
            })

            await Promise.allSettled(tasks)
          }
        }
      } catch (mailSetupError) {
        console.warn('[advisories] email setup error:', mailSetupError)
      }
    } else {
      console.warn('[advisories] SMTP not fully configured; skipping email send.')
    }

    return NextResponse.json({ ok: true, advisory: inserted, stats: { emailsSent, emailsAttempted, emailErrors } })
  } catch (error: any) {
    console.error('[advisories] unexpected error:', error)
    return NextResponse.json({ ok: false, error: error?.message || 'Unknown error' }, { status: 500 })
  }
}

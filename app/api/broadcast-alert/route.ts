import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { GoogleAuth } from 'google-auth-library'

let webpush: any = null
let nodemailer: any = null
let googleAuth: GoogleAuth | null = null
let fcmProjectId: string | null = null

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'

function loadServiceAccountFromEnv(): { credentials?: any; keyFile?: string } {
  const base64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64
  if (base64) {
    try {
      const json = Buffer.from(base64, 'base64').toString('utf-8')
      const credentials = JSON.parse(json)
      return { credentials }
    } catch (error) {
      console.warn('Failed to parse GOOGLE_APPLICATION_CREDENTIALS_BASE64', error)
      throw new Error('Invalid GOOGLE_APPLICATION_CREDENTIALS_BASE64 value')
    }
  }

  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (keyFile) {
    return { keyFile }
  }

  return {}
}

async function ensureFcmAuthLoaded() {
  if (!googleAuth) {
    const { credentials, keyFile } = loadServiceAccountFromEnv()
    if (!credentials && !keyFile) {
      throw new Error('Missing FCM credentials. Provide GOOGLE_APPLICATION_CREDENTIALS_BASE64 or GOOGLE_APPLICATION_CREDENTIALS.')
    }

    googleAuth = new GoogleAuth({
      credentials,
      keyFile,
      scopes: [FCM_SCOPE],
    })

    if (credentials?.project_id) {
      fcmProjectId = credentials.project_id
    }
  }

  if (!fcmProjectId) {
    try {
      fcmProjectId = await googleAuth!.getProjectId()
    } catch (error) {
      console.warn('Unable to resolve FCM project ID from credentials', error)
      throw new Error('Failed to resolve FCM project ID')
    }
  }

  return googleAuth!
}

async function getFcmAccessToken() {
  const auth = await ensureFcmAuthLoaded()
  const client = await auth.getClient()
  const accessTokenResponse = await client.getAccessToken()
  const token = typeof accessTokenResponse === 'string'
    ? accessTokenResponse
    : accessTokenResponse?.token

  if (!token) {
    throw new Error('Unable to obtain FCM access token')
  }

  return token
}

async function ensureWebPushLoaded() {
  if (!webpush) {
    try { webpush = (await import('web-push')).default || (await import('web-push')) } catch {}
  }
  return webpush
}

async function ensureMailerLoaded() {
  if (!nodemailer) {
    try { nodemailer = (await import('nodemailer')).default || (await import('nodemailer')) } catch {}
  }
  return nodemailer
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin/superadmin
    const { data: profile, error: profileErr } = await supabase
      .from('users')
      .select('id, user_type, email, firstName, lastName')
      .eq('id', user.id)
      .single()
    if (profileErr || !profile || !['admin','superadmin'].includes(profile.user_type)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }

    const bodyJson = await req.json()
    const type = String(bodyJson?.type || '').toLowerCase()
    const bodyText = String(bodyJson?.body || '').trim()
    const title = String(bodyJson?.title || (type === 'earthquake' ? 'Earthquake Alert' : type === 'tsunami' ? 'Tsunami Alert' : 'MDRRMO Alert'))
    if (!['earthquake', 'tsunami'].includes(type)) {
      return NextResponse.json({ ok: false, error: 'Invalid type' }, { status: 400 })
    }

    // Insert broadcast record
    const { data: insertData, error: insertErr } = await supabase
      .from('broadcast_alerts')
      .insert({ type, title, body: bodyText, created_by: user.id })
      .select()
      .single()
    if (insertErr) {
      console.error('Failed to insert broadcast_alert:', insertErr)
      return NextResponse.json({ ok: false, error: 'Failed to create broadcast' }, { status: 500 })
    }

    // Fetch push subscriptions (fan-out)
    const { data: subs, error: subsErr } = await supabase
      .from('push_subscriptions')
      .select('subscription, platform')
    if (subsErr) {
      console.warn('Could not fetch push subscriptions:', subsErr)
    }

    const payload = {
      title,
      body: bodyText || (type === 'earthquake' ? 'An earthquake alert has been issued.' : 'A tsunami alert has been issued.'),
      type,
      url: '/',
    }

    // Attempt Web Push for web subscriptions
    let webPushSent = 0
    try {
      const wp = await ensureWebPushLoaded()
      const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
      const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com'
      if (wp && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
        wp.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
        const webSubs = (subs || []).filter((s: any) => s?.subscription?.endpoint)
        const tasks = webSubs.map((s: any) => {
          try {
            return wp.sendNotification(s.subscription, JSON.stringify(payload)).then(() => { webPushSent += 1 }).catch(() => {})
          } catch { return Promise.resolve() }
        })
        await Promise.allSettled(tasks)
      }
    } catch (e) {
      console.warn('Web Push broadcast error:', e)
    }

    // Optional FCM send for native tokens (HTTP v1)
    let fcmSent = 0
    try {
      const nativeSubs = (subs || []).filter((s: any) => s?.subscription && !s?.subscription?.endpoint)
      if (nativeSubs.length > 0) {
        const accessToken = await getFcmAccessToken()
        if (!fcmProjectId) {
          throw new Error('FCM project ID unavailable')
        }

        const tasks = nativeSubs.map(async (s: any) => {
          const token = s?.subscription?.value || s?.subscription?.token || s?.subscription?.registrationId
          if (!token) return
          try {
            const messagePayload = {
              message: {
                token,
                notification: {
                  title: payload.title,
                  body: payload.body,
                },
                data: {
                  type: payload.type,
                  url: payload.url,
                },
                android: {
                  priority: 'high',
                  notification: {
                    sound: 'default',
                    clickAction: payload.url,
                  },
                },
                apns: {
                  payload: {
                    aps: {
                      sound: 'default',
                    },
                  },
                },
                webpush: {
                  headers: {
                    Urgency: 'high',
                  },
                  notification: {
                    icon: '/icons/icon-192x192.png',
                    data: {
                      url: payload.url,
                    },
                  },
                },
              },
            }

            await fetch(`https://fcm.googleapis.com/v1/projects/${fcmProjectId}/messages:send`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify(messagePayload),
            })

            fcmSent += 1
          } catch (err) {
            console.warn('FCM token send failed', err)
          }
        })

        await Promise.allSettled(tasks)
      }
    } catch (e) {
      console.warn('FCM broadcast error:', e)
    }

    let emailSent = 0
    let emailAttempted = 0
    const emailErrors: { email: string; error: string }[] = []
    try {
      const SMTP_HOST = process.env.SMTP_HOST
      const SMTP_PORT = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined
      const SMTP_USER = process.env.SMTP_USER
      const SMTP_PASS = process.env.SMTP_PASS
      const rawFrom = (process.env.SMTP_FROM || '').trim()
      const SMTP_FROM = rawFrom.replace(/^"|"$/g, '') || SMTP_USER

      if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
        const mailer = await ensureMailerLoaded()
        if (mailer) {
          const transporter = mailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_PORT === 465,
            auth: { user: SMTP_USER, pass: SMTP_PASS },
          })
          const { data: users } = await supabase
            .from('users')
            .select('email, firstName, lastName')
            .in('user_type', ['user', 'hospital'])
            .not('email', 'is', null)
            .limit(1000)
          const tasks = (users || []).map(async (u: any) => {
            const email = u?.email?.trim()
            if (!email) return
            emailAttempted += 1
            const name = [u?.firstName, u?.lastName].filter(Boolean).join(' ') || 'Citizen'
            const text = [
              `Hello ${name},`,
              '',
              payload.body,
              '',
              'This is an automated alert from MDRRMO.',
            ].join('\n')
            try {
              await transporter.sendMail({
                from: SMTP_FROM,
                to: email,
                subject: title,
                text,
              })
              emailSent += 1
            } catch (err) {
              console.warn('[broadcast-alert] email send failed for', email, err)
              const message = err instanceof Error ? err.message : String(err)
              emailErrors.push({ email, error: message })
            }
          })
          await Promise.allSettled(tasks)
        }
      }
    } catch (e) {
      console.warn('Email blast error:', e)
    }

    return NextResponse.json({ ok: true, broadcast: insertData, stats: { webPushSent, fcmSent, emailSent, emailAttempted, emailErrors } })
  } catch (e: any) {
    console.error('[broadcast-alert] error', e)
    return NextResponse.json({ ok: false, error: e?.message || 'Unknown error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
  const {
    emergencyType,
    latitude,
    longitude,
    locationAddress,
    casualties,
    clientTimestamp
  } = body || {}
  if (
    typeof emergencyType !== 'string' ||
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    typeof locationAddress !== 'string'
  ) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  const { data: userProfile, error: profileError } = await supabase
    .from('users')
    .select('id, firstName, middleName, lastName, mobileNumber')
    .eq('id', user.id)
    .single()
  if (profileError || !userProfile) {
    return NextResponse.json({ error: 'Profile unavailable' }, { status: 500 })
  }
  const timestamp = clientTimestamp && typeof clientTimestamp === 'string' ? clientTimestamp : new Date().toISOString()
  const insertPayload: Record<string, any> = {
    user_id: user.id,
    firstName: userProfile.firstName,
    middleName: userProfile.middleName ?? null,
    lastName: userProfile.lastName,
    mobileNumber: userProfile.mobileNumber,
    latitude,
    longitude,
    location_address: locationAddress,
    emergency_type: emergencyType,
    status: 'active',
    created_at: timestamp,
    reportedAt: timestamp,
    reporterMobile: userProfile.mobileNumber
  }
  if (typeof casualties === 'number' && casualties >= 0) {
    insertPayload.casualties = casualties
  }
  const { data: reportData, error: reportError } = await supabaseAdmin
    .from('emergency_reports')
    .insert(insertPayload)
    .select()
    .single()
  if (reportError || !reportData) {
    if (reportError) {
      console.error('[api/emergency/report] emergency_reports insert failed', reportError)
    }
    return NextResponse.json({ error: 'Failed to record report', details: reportError }, { status: 500 })
  }
  await supabaseAdmin.from('admin_notifications').insert({
    emergency_report_id: reportData.id,
    message: `🚨 NEW EMERGENCY ALERT: ${userProfile.firstName} ${userProfile.lastName} reported: ${emergencyType} at ${locationAddress}`,
    is_read: false,
    type: 'new_report',
    created_at: new Date().toISOString()
  })
  await supabaseAdmin.from('user_notifications').insert({
    user_id: user.id,
    emergency_report_id: reportData.id,
    message: `Your emergency alert for "${emergencyType}" has been sent. Help is on the way!`,
    is_read: false,
    created_at: new Date().toISOString()
  })
  return NextResponse.json({ success: true, reportId: reportData.id })
}

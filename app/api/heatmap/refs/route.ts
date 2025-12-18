import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [barangaysRes, incidentTypesRes, erTeamsRes] = await Promise.all([
      supabaseAdmin.from('barangays').select('id, name').order('name', { ascending: true }),
      supabaseAdmin.from('incident_types').select('id, name').order('name', { ascending: true }),
      supabaseAdmin.from('er_teams').select('id, name').order('name', { ascending: true }),
    ])

    if (barangaysRes.error) {
      console.error('[heatmap/refs] barangays error', barangaysRes.error)
      return NextResponse.json({ error: 'Failed to load barangays' }, { status: 500 })
    }
    if (incidentTypesRes.error) {
      console.error('[heatmap/refs] incident types error', incidentTypesRes.error)
      return NextResponse.json({ error: 'Failed to load incident types' }, { status: 500 })
    }
    if (erTeamsRes.error) {
      console.error('[heatmap/refs] er teams error', erTeamsRes.error)
      return NextResponse.json({ error: 'Failed to load ER teams' }, { status: 500 })
    }

    return NextResponse.json({
      barangays: barangaysRes.data ?? [],
      incidentTypes: incidentTypesRes.data ?? [],
      erTeams: erTeamsRes.data ?? [],
    })
  } catch (error) {
    console.error('[heatmap/refs] unexpected error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  incidentTypeId: z.coerce.number().int().positive().optional(),
  barangayId: z.coerce.number().int().positive().optional(),
  erTeamId: z.coerce.number().int().positive().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const params = Object.fromEntries(url.searchParams.entries())
    const parseResult = querySchema.safeParse(params)
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid query parameters', details: parseResult.error.flatten() }, { status: 400 })
    }
    const filters = parseResult.data

    let query = supabaseAdmin
      .from('internal_reports')
      .select('original_report_id, barangay_id, incident_type_id, er_team_id, incident_date')

    if (filters.incidentTypeId) {
      query = query.eq('incident_type_id', filters.incidentTypeId)
    }
    if (filters.barangayId) {
      query = query.eq('barangay_id', filters.barangayId)
    }
    if (filters.erTeamId) {
      query = query.eq('er_team_id', filters.erTeamId)
    }
    if (filters.dateFrom) {
      query = query.gte('incident_date', filters.dateFrom.toISOString())
    }
    if (filters.dateTo) {
      query = query.lte('incident_date', filters.dateTo.toISOString())
    }

    const { data: internalReports, error } = await query as { data: any[] | null, error: any }

    if (error) {
      console.error('[heatmap] query failed', error)
      return NextResponse.json({ error: 'Failed to fetch incidents' }, { status: 500 })
    }

    const barangayCounts = new Map<number, number>()
    const originalIds = new Set<string>()

    for (const row of internalReports || []) {
      if (typeof row.barangay_id === 'number') {
        barangayCounts.set(row.barangay_id, (barangayCounts.get(row.barangay_id) ?? 0) + 1)
      }
      if (row.original_report_id) {
        originalIds.add(row.original_report_id)
      }
    }

    let coordinateMap = new Map<string, { lat: number; lon: number }>()

    if (originalIds.size > 0) {
      const { data: emergencyReports, error: emergencyError } = await supabaseAdmin
        .from('emergency_reports')
        .select('id, latitude, longitude')
        .in('id', Array.from(originalIds))

      if (emergencyError) {
        console.error('[heatmap] failed to load emergency report coordinates', emergencyError)
        return NextResponse.json({ error: 'Failed to load incident locations' }, { status: 500 })
      }

      coordinateMap = new Map(
        (emergencyReports || [])
          .filter((row) => typeof row.latitude === 'number' && typeof row.longitude === 'number')
          .map((row) => [row.id as string, { lat: row.latitude as number, lon: row.longitude as number }])
      )
    }

    const points: { lat: number; lon: number; weight: number; barangayId: number | null }[] = []

    for (const row of internalReports || []) {
      if (!row.original_report_id) continue
      const coord = coordinateMap.get(row.original_report_id)
      if (!coord) continue
      points.push({ lat: coord.lat, lon: coord.lon, weight: 1, barangayId: row.barangay_id ?? null })
    }

    const totalsByBarangay = Array.from(barangayCounts.entries()).map(([barangayId, count]) => ({ barangayId, count }))

    return NextResponse.json({ points, totalsByBarangay })
  } catch (error) {
    console.error('[heatmap] unexpected error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

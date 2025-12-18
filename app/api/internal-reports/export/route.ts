import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const requestSchema = z.object({
  incidentTypeId: z.number().int().positive().nullable().optional(),
  barangayId: z.number().int().positive().nullable().optional(),
  erTeamId: z.number().int().positive().nullable().optional(),
  dateFrom: z.string().datetime().nullable().optional(),
  dateTo: z.string().datetime().nullable().optional(),
  searchTerm: z.string().trim().min(1).nullable().optional(),
})

type RequestPayload = z.infer<typeof requestSchema>

const CSV_HEADERS = [
  'Report ID',
  'Original Incident ID',
  'Incident Type',
  'Incident Date',
  'Time Responded',
  'Barangay',
  'ER Team',
  'Persons Involved',
  'Number of Responders',
  'Prepared By',
  'Created At',
  'Patient Name',
  'Patient Contact Number',
  'Patient Birthday',
  'Patient Age',
  'Patient Address',
  'Patient Sex',
  'Evacuation Priority',
  'Emergency Category',
  'Airway Interventions',
  'Breathing Support',
  'Circulation Status',
  'Body Parts (Front)',
  'Body Parts (Back)',
  'Injury Types',
  'Incident Location',
  'MOI / POI / TOI',
  'Receiving Hospital Name',
  'Receiving Hospital Date',
  'EMT / ERT Date',
]

const escapeForCsv = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (text.includes('"') || text.includes(',') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

const buildDateFilters = (payload: RequestPayload) => {
  const filters: { incidentDateFrom?: string; incidentDateTo?: string } = {}
  if (payload.dateFrom) {
    filters.incidentDateFrom = payload.dateFrom
  }
  if (payload.dateTo) {
    filters.incidentDateTo = payload.dateTo
  }
  return filters
}

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const payload = requestSchema.parse(json)

    let query = supabaseAdmin
      .from('internal_reports')
      .select('*')
      .order('created_at', { ascending: false })

    if (payload.incidentTypeId) {
      query = query.eq('incident_type_id', payload.incidentTypeId)
    }
    if (payload.barangayId) {
      query = query.eq('barangay_id', payload.barangayId)
    }
    if (payload.erTeamId) {
      query = query.eq('er_team_id', payload.erTeamId)
    }

    const { incidentDateFrom, incidentDateTo } = buildDateFilters(payload)
    if (incidentDateFrom) {
      query = query.gte('incident_date', incidentDateFrom)
    }
    if (incidentDateTo) {
      query = query.lte('incident_date', incidentDateTo)
    }

    const { data: reports, error: reportsError } = await query

    if (reportsError) {
      console.error('[internal-reports] failed to load reports for export', reportsError)
      return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 })
    }

    if (!reports || reports.length === 0) {
      const emptyCsv = `${CSV_HEADERS.join(',')}\r\n`
      return new NextResponse(emptyCsv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="internal-reports.csv"',
        },
      })
    }

    const [{ data: barangays }, { data: incidentTypes }, { data: erTeams }] = await Promise.all([
      supabaseAdmin.from('barangays').select('id, name'),
      supabaseAdmin.from('incident_types').select('id, name'),
      supabaseAdmin.from('er_teams').select('id, name'),
    ])

    const barangayNames = new Map<number, string>((barangays ?? []).map((b) => [b.id, b.name]))
    const incidentTypeNames = new Map<number, string>((incidentTypes ?? []).map((it) => [it.id, it.name]))
    const erTeamNames = new Map<number, string>((erTeams ?? []).map((et) => [et.id, et.name]))

    let filteredReports = reports

    if (payload.searchTerm) {
      const term = payload.searchTerm.toLowerCase()
      filteredReports = filteredReports.filter((report) => {
        const preparedByMatch = report.prepared_by?.toLowerCase().includes(term)
        const reportIdMatch = String(report.id).includes(term)
        const originalIdMatch = report.original_report_id?.toLowerCase().includes(term)
        const barangayName = barangayNames.get(report.barangay_id)?.toLowerCase() ?? ''
        const incidentTypeName = incidentTypeNames.get(report.incident_type_id)?.toLowerCase() ?? ''
        const erTeamName = erTeamNames.get(report.er_team_id)?.toLowerCase() ?? ''
        const nameMatch = barangayName.includes(term) || incidentTypeName.includes(term) || erTeamName.includes(term)
        return Boolean(preparedByMatch || reportIdMatch || originalIdMatch || nameMatch)
      })
    }

    const csvRows = filteredReports.map((report) => {
      const row = [
        report.id,
        report.original_report_id ?? '',
        incidentTypeNames.get(report.incident_type_id) ?? '',
        report.incident_date ? new Date(report.incident_date).toISOString() : '',
        report.time_responded ? new Date(report.time_responded).toISOString() : '',
        barangayNames.get(report.barangay_id) ?? '',
        erTeamNames.get(report.er_team_id) ?? '',
        report.persons_involved ?? '',
        report.number_of_responders ?? '',
        report.prepared_by ?? '',
        report.created_at ? new Date(report.created_at).toISOString() : '',
        report.patient_name ?? '',
        report.patient_contact_number ?? '',
        report.patient_birthday ?? '',
        report.patient_age ?? '',
        report.patient_address ?? '',
        report.patient_sex ?? '',
        report.evacuation_priority ?? '',
        report.emergency_category ?? '',
        report.airway_interventions ?? '',
        report.breathing_support ?? '',
        report.circulation_status ?? '',
        report.body_parts_front ?? '',
        report.body_parts_back ?? '',
        report.injury_types ?? '',
        report.incident_location ?? '',
        report.moi_poi_toi ?? '',
        report.receiving_hospital_name ?? '',
        report.receiving_hospital_date ? new Date(report.receiving_hospital_date).toISOString() : '',
        report.emt_ert_date ? new Date(report.emt_ert_date).toISOString() : '',
      ]
      return row.map(escapeForCsv).join(',')
    })

    const csvContent = [CSV_HEADERS.join(','), ...csvRows].join('\r\n')

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="internal-reports.csv"',
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request payload', details: error.errors }, { status: 400 })
    }
    console.error('[internal-reports] unexpected export error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

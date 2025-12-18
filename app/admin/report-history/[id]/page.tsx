"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { InternalReportDetail, type InternalReportRecord, type InternalReportPatientRecord } from "@/components/admin/internal-report-detail"

interface BaseEntry {
  id: number
  name: string
}

interface HospitalEntry {
  id: string
  name: string
}

const mapPatientsWithHospitalNames = (
  patients: InternalReportPatientRecord[] = [],
  hospitals: HospitalEntry[] = [],
): InternalReportPatientRecord[] => {
  if (!patients.length) {
    return patients
  }

  if (!hospitals.length) {
    return patients.map((patient) => ({ ...patient }))
  }

  const hospitalMap = new Map<string, string>()
  hospitals.forEach((hospital) => {
    hospitalMap.set(String(hospital.id), hospital.name)
  })

  return patients.map((patient) => {
    const hospitalId = patient.receiving_hospital_id ? String(patient.receiving_hospital_id) : null
    const fallbackName = hospitalId ? hospitalMap.get(hospitalId) ?? null : null

    if (fallbackName && patient.receiving_hospital_name !== fallbackName) {
      return {
        ...patient,
        receiving_hospital_name: patient.receiving_hospital_name ?? fallbackName,
      }
    }

    return { ...patient }
  })
}

const fetchSingleEntry = async (table: string, id: number) => {
  const { data, error } = await supabase
    .from(table)
    .select("id, name")
    .eq("id", id)
    .single()

  if (error) throw error
  return data as BaseEntry
}

const fetchInternalReportById = async (id: number) => {
  const { data, error } = await supabase
    .from("internal_reports")
    .select("*")
    .eq("id", id)
    .single()

  if (error) throw error
  return data as InternalReportRecord
}

const InternalReportDetailPage = () => {
  const params = useParams()
  const router = useRouter()
  const reportId = Number(params?.id)

  const [report, setReport] = React.useState<InternalReportRecord | null>(null)
  const [barangayName, setBarangayName] = React.useState<string>("")
  const [incidentTypeName, setIncidentTypeName] = React.useState<string>("")
  const [erTeamName, setErTeamName] = React.useState<string>("")
  const [patients, setPatients] = React.useState<InternalReportPatientRecord[]>([])
  const [hospitalNameLookup, setHospitalNameLookup] = React.useState<Record<string, string>>({})
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const loadReport = async () => {
      if (!reportId || Number.isNaN(reportId)) {
        setError("Invalid report ID")
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const fetchedReport = await fetchInternalReportById(reportId)
        setReport(fetchedReport)

        const [patientsRes, hospitalsRes] = await Promise.all([
          supabase
            .from("internal_report_patients")
            .select(`
              *,
              receiving_hospital:hospitals!internal_report_patients_receiving_hospital_id_fkey ( name )
            `)
            .eq("internal_report_id", reportId)
            .order("created_at", { ascending: true }),
          supabase
            .from("hospitals")
            .select("id, name")
            .order("name", { ascending: true }),
        ])

        if (patientsRes.error) throw patientsRes.error
        if (hospitalsRes.error) throw hospitalsRes.error

        type PatientQueryRow = InternalReportPatientRecord & { receiving_hospital?: { name: string | null } | null }
        const sanitizedPatients = (patientsRes.data ?? []).map((row) => {
          const { receiving_hospital, ...rest } = row as unknown as PatientQueryRow
          return {
            ...rest,
            receiving_hospital_name: receiving_hospital?.name ?? rest.receiving_hospital_name ?? null,
          } as InternalReportPatientRecord
        })

        const hospitals = (hospitalsRes.data ?? []) as HospitalEntry[]
        setPatients(mapPatientsWithHospitalNames(sanitizedPatients, hospitals))
        const nameMap: Record<string, string> = {}
        hospitals.forEach((hospital) => {
          nameMap[String(hospital.id)] = hospital.name
        })
        setHospitalNameLookup(nameMap)

        const [barangay, incidentType, erTeam] = await Promise.all([
          fetchSingleEntry("barangays", fetchedReport.barangay_id),
          fetchSingleEntry("incident_types", fetchedReport.incident_type_id),
          fetchSingleEntry("er_teams", fetchedReport.er_team_id),
        ])

        setBarangayName(barangay?.name ?? "")
        setIncidentTypeName(incidentType?.name ?? "")
        setErTeamName(erTeam?.name ?? "")
      } catch (err: any) {
        console.error("Failed to load report detail:", err)
        setError(err?.message ?? "Failed to load report detail")
      } finally {
        setLoading(false)
      }
    }

    void loadReport()
  }, [reportId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 flex items-center justify-center text-gray-600">
        Loading report detail...
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 flex flex-col items-center justify-center text-red-600 space-y-4">
        <p>{error}</p>
        <button
          className="rounded bg-orange-500 px-4 py-2 text-white hover:bg-orange-600"
          onClick={() => router.back()}
        >
          Back to Report History
        </button>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 flex flex-col items-center justify-center text-gray-600 space-y-4">
        <p>Report not found.</p>
        <button
          className="rounded bg-orange-500 px-4 py-2 text-white hover:bg-orange-600"
          onClick={() => router.back()}
        >
          Back to Report History
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <button
          className="mb-6 rounded bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
          onClick={() => router.back()}
        >
          Back to Report History
        </button>
        <InternalReportDetail
          report={report}
          patients={patients}
          barangayName={barangayName}
          incidentTypeName={incidentTypeName}
          erTeamName={erTeamName}
          hospitalNameLookup={hospitalNameLookup}
        />
      </div>
    </div>
  )
}

export default InternalReportDetailPage

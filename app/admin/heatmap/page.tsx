import { IncidentHeatMap } from "@/components/admin/IncidentHeatMap"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

interface BaseEntry {
  id: number
  name: string
}

export default async function AdminHeatMapPage() {
  let error: string | null = null
  let barangays: BaseEntry[] = []
  let incidentTypes: BaseEntry[] = []
  let erTeams: BaseEntry[] = []

  try {
    const [bRes, tRes, eRes] = await Promise.all([
      supabaseAdmin.from('barangays').select('id, name').order('name', { ascending: true }),
      supabaseAdmin.from('incident_types').select('id, name').order('name', { ascending: true }),
      supabaseAdmin.from('er_teams').select('id, name').order('name', { ascending: true }),
    ])

    if (bRes.error) {
      console.error('[admin/heatmap] barangays error', bRes.error)
      error = 'Failed to load barangays'
    } else {
      barangays = (bRes.data as BaseEntry[]) ?? []
    }

    if (tRes.error) {
      console.error('[admin/heatmap] incident types error', tRes.error)
      error = error ?? 'Failed to load incident types'
    } else {
      incidentTypes = (tRes.data as BaseEntry[]) ?? []
    }

    if (eRes.error) {
      console.error('[admin/heatmap] er teams error', eRes.error)
      error = error ?? 'Failed to load ER teams'
    } else {
      erTeams = (eRes.data as BaseEntry[]) ?? []
    }
  } catch (e: any) {
    console.error('[admin/heatmap] unexpected error', e)
    error = e?.message || 'Failed to load reference data'
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Incident Heat Map</h1>
      <div>
        <Button variant="outline" className="bg-gray-200 hover:bg-gray-300 text-gray-800" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Link>
        </Button>
      </div>
      {error && (
        <Card className="max-w-xl">
          <CardContent className="p-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
      <IncidentHeatMap barangays={barangays} incidentTypes={incidentTypes} erTeams={erTeams} />
    </div>
  )
}

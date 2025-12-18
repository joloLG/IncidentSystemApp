"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import "leaflet/dist/leaflet.css"
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png"
import markerIcon from "leaflet/dist/images/marker-icon.png"
import markerShadow from "leaflet/dist/images/marker-shadow.png"

interface BaseEntry {
  id: number
  name: string
}

interface HeatPoint {
  lat: number
  lon: number
  weight: number
  barangayId: number | null
}

interface BarangayTotal {
  barangayId: number
  count: number
}

interface IncidentHeatMapProps {
  barangays: BaseEntry[]
  incidentTypes: BaseEntry[]
  erTeams: BaseEntry[]
}

const BULAN_CENTER: [number, number] = [12.6718, 123.8755]
const BULAN_BOUNDS: [[number, number], [number, number]] = [
  [12.6305, 123.8225],
  [12.7125, 123.923]
]

export function IncidentHeatMap({ barangays, incidentTypes, erTeams }: IncidentHeatMapProps) {
  const [isClient, setIsClient] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const heatLayerRef = useRef<any>(null)
  const [mapInitialized, setMapInitialized] = useState(false)
  const hasAutoFittedRef = useRef(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const [incidentTypeFilter, setIncidentTypeFilter] = useState<number | "all">("all")
  const [barangayFilter, setBarangayFilter] = useState<number | "all">("all")
  const [erTeamFilter, setErTeamFilter] = useState<number | "all">("all")
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")

  const [points, setPoints] = useState<HeatPoint[]>([])
  const [totalsByBarangay, setTotalsByBarangay] = useState<BarangayTotal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isClient || !containerRef.current || mapRef.current) {
      return
    }

    let rafId: number | null = null
    const cleanupRef: { current: (() => void) | null } = { current: null }

    const initializeMap = async () => {
      const el = containerRef.current
      if (!el) return

      const L = (await import('leaflet')).default

      const iconDefault = L.Icon.Default as any
      if (iconDefault && iconDefault.prototype && iconDefault.prototype._getIconUrl) {
        delete iconDefault.prototype._getIconUrl
      }
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: markerIcon2x.src,
        iconUrl: markerIcon.src,
        shadowUrl: markerShadow.src,
      })
      await import('leaflet.heat')

      const map = L.map(el, {
        zoomControl: true,
        center: BULAN_CENTER,
        zoom: 12,
        minZoom: 10,
        maxZoom: 18,
        maxBounds: BULAN_BOUNDS,
        maxBoundsViscosity: 1.0,
      })

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      mapRef.current = map

      const invalidate = () => {
        if (!mapRef.current) return
        mapRef.current.invalidateSize()
      }

      map.whenReady(() => {
        map.fitBounds(BULAN_BOUNDS, { padding: [20, 20] })

        // Add geo-fencing event listeners
        map.on('moveend', () => {
          const bounds = map.getBounds()
          const currentCenter = map.getCenter()

          // Check if center is outside allowed bounds
          if (currentCenter.lat < BULAN_BOUNDS[0][0] || currentCenter.lat > BULAN_BOUNDS[1][0] ||
              currentCenter.lng < BULAN_BOUNDS[0][1] || currentCenter.lng > BULAN_BOUNDS[1][1]) {
            console.log('[heatmap] Map moved outside Bulan bounds, recentering...')
            map.panTo(BULAN_CENTER)
          }
        })

        map.on('dragend', () => {
          const bounds = map.getBounds()
          // If the dragged view is outside bounds, snap back
          const sw = bounds.getSouthWest()
          const ne = bounds.getNorthEast()
          const isOutsideBounds = sw.lat < BULAN_BOUNDS[0][0] || ne.lat > BULAN_BOUNDS[1][0] ||
                                  sw.lng < BULAN_BOUNDS[0][1] || ne.lng > BULAN_BOUNDS[1][1]

          if (isOutsideBounds) {
            console.log('[heatmap] Drag moved outside Bulan bounds, recentering...')
            map.panTo(BULAN_CENTER)
          }
        })

        const heatLayer = (L as any).heatLayer([], {
          radius: 35,
          blur: 25,
          maxZoom: 16,
          gradient: {
            0.2: "#4ade80",
            0.4: "#facc15",
            0.6: "#fb923c",
            0.8: "#f97316",
            1.0: "#dc2626",
          },
        })

        const attachHeatLayer = (retries: number) => {
          const elNow = containerRef.current
          if (!mapRef.current || !elNow) return
          const size = mapRef.current.getSize?.()
          const sized = !!size && size.x > 0 && size.y > 0
          const visible = elNow.clientWidth > 0 && elNow.clientHeight > 0
          if (!sized || !visible) {
            if (retries <= 0) {
              console.warn('[heatmap] map/container size is zero; skipping heat layer attach')
              return
            }
            rafId = requestAnimationFrame(() => attachHeatLayer(retries - 1))
            return
          }
          try {
            mapRef.current.invalidateSize()
            heatLayer.addTo(mapRef.current)
            heatLayerRef.current = heatLayer
            setMapInitialized(true)
            hasAutoFittedRef.current = false
          } catch (e) {
            if (retries > 0) {
              setTimeout(() => attachHeatLayer(retries - 1), 100)
            } else {
              console.error('[heatmap] failed to attach heat layer', e)
            }
          }
        }

        setTimeout(() => attachHeatLayer(90), 100)
      })

      if (typeof window !== 'undefined') {
        window.addEventListener('resize', invalidate)
      }

      cleanupRef.current = () => {
        if (typeof window !== 'undefined') {
          window.removeEventListener('resize', invalidate)
        }
        if (mapRef.current) {
          mapRef.current.remove()
          mapRef.current = null
        }
      }
    }

    const ensureContainerReady = () => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      if (rect.height <= 0 || rect.width <= 0) {
        rafId = requestAnimationFrame(ensureContainerReady)
        return
      }
      initializeMap()
    }

    ensureContainerReady()

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      if (cleanupRef.current) cleanupRef.current()
    }
  }, [isClient])

  const fetchHeatmap = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      if (incidentTypeFilter !== "all") params.append("incidentTypeId", String(incidentTypeFilter))
      if (barangayFilter !== "all") params.append("barangayId", String(barangayFilter))
      if (erTeamFilter !== "all") params.append("erTeamId", String(erTeamFilter))
      if (dateFrom) params.append("dateFrom", dateFrom)
      if (dateTo) params.append("dateTo", dateTo)

      const response = await fetch(`/api/heatmap?${params.toString()}`)
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`)
      }
      const json = await response.json()
      setPoints(json.points ?? [])
      setTotalsByBarangay(json.totalsByBarangay ?? [])
    } catch (err: any) {
      console.error("Failed to fetch heatmap data", err)
      setError(err?.message || "Failed to load heatmap data")
      setPoints([])
      setTotalsByBarangay([])
    } finally {
      setLoading(false)
    }
  }, [incidentTypeFilter, barangayFilter, erTeamFilter, dateFrom, dateTo])

  useEffect(() => {
    void fetchHeatmap()
  }, [fetchHeatmap])

  useEffect(() => {
    if (!heatLayerRef.current) return
    const heatData = points.map((p) => [p.lat, p.lon, p.weight]) as [number, number, number][]
    heatLayerRef.current.setLatLngs(heatData)

    if (!mapRef.current) {
      return
    }

    if (hasAutoFittedRef.current) {
      return
    }

    const latValues = [
      ...heatData.map(p => p[0]),
      BULAN_BOUNDS[0][0],
      BULAN_BOUNDS[1][0]
    ].filter(lat => lat >= BULAN_BOUNDS[0][0] && lat <= BULAN_BOUNDS[1][0])

    const lngValues = [
      ...heatData.map(p => p[1]),
      BULAN_BOUNDS[0][1],
      BULAN_BOUNDS[1][1]
    ].filter(lng => lng >= BULAN_BOUNDS[0][1] && lng <= BULAN_BOUNDS[1][1])

    // Ensure we have valid bounds within Bulan area
    if (latValues.length > 0 && lngValues.length > 0) {
      const minLat = Math.max(BULAN_BOUNDS[0][0], Math.min(...latValues))
      const maxLat = Math.min(BULAN_BOUNDS[1][0], Math.max(...latValues))
      const minLng = Math.max(BULAN_BOUNDS[0][1], Math.min(...lngValues))
      const maxLng = Math.min(BULAN_BOUNDS[1][1], Math.max(...lngValues))

      const padding = heatData.length > 0 ? 0.001 : 0
      mapRef.current.fitBounds([
        [minLat - padding, minLng - padding],
        [maxLat + padding, maxLng + padding]
      ], { padding: [20, 20], maxZoom: 16 })
    } else {
      // No valid points within bounds, center on Bulan
      mapRef.current.setView(BULAN_CENTER, 12)
    }
    hasAutoFittedRef.current = true
  }, [points])

  const totals = useMemo(() => {
    return totalsByBarangay
      .map((row) => ({
        barangayName: barangays.find((b) => b.id === row.barangayId)?.name || `Barangay ${row.barangayId}`,
        count: row.count,
      }))
      .sort((a, b) => b.count - a.count)
  }, [totalsByBarangay, barangays])

  return (
    <Card className="shadow-lg h-full rounded-lg">
      <CardHeader className="bg-orange-600 text-white rounded-t-lg p-4">
        <CardTitle className="text-2xl font-bold">Incident Heat Map</CardTitle>
      </CardHeader>
      <CardContent className="p-6 bg-white rounded-b-lg space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Incident Type</p>
            <Select value={String(incidentTypeFilter)} onValueChange={(value) => setIncidentTypeFilter(value === "all" ? "all" : Number(value))}>
              <SelectTrigger>
                <SelectValue placeholder="All Incident Types" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                <SelectItem value="all">All Incident Types</SelectItem>
                {incidentTypes.map((type) => (
                  <SelectItem key={type.id} value={String(type.id)}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Barangay</p>
            <Select value={String(barangayFilter)} onValueChange={(value) => setBarangayFilter(value === "all" ? "all" : Number(value))}>
              <SelectTrigger>
                <SelectValue placeholder="All Barangays" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                <SelectItem value="all">All Barangays</SelectItem>
                {barangays.map((barangay) => (
                  <SelectItem key={barangay.id} value={String(barangay.id)}>
                    {barangay.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">ER Team</p>
            <Select value={String(erTeamFilter)} onValueChange={(value) => setErTeamFilter(value === "all" ? "all" : Number(value))}>
              <SelectTrigger>
                <SelectValue placeholder="All ER Teams" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                <SelectItem value="all">All ER Teams</SelectItem>
                {erTeams.map((team) => (
                  <SelectItem key={team.id} value={String(team.id)}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Date From</p>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Date To</p>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={() => void fetchHeatmap()} disabled={loading}>
            {loading ? "Loading..." : "Refresh Heatmap"}
          </Button>
          <span className="text-sm text-gray-500">Showing {points.length} incident points</span>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div
          className="w-full h-[500px] rounded-lg overflow-hidden border relative"
          ref={containerRef}
          style={{ minHeight: 500, height: 500 }}
        >
          {!isClient && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-gray-50">
              Loading map...
            </div>
          )}
          {isClient && !mapInitialized && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-gray-50">
              Initializing map...
            </div>
          )}
          {isClient && !points.length && !loading && mapInitialized && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500">
              No incidents found for the selected filters.
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Barangay Totals</h3>
          {totals.length === 0 ? (
            <p className="text-sm text-gray-500">No incidents recorded for the selected filters.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {totals.map((row) => (
                <div key={row.barangayName} className="border rounded-lg p-3 bg-gray-50">
                  <p className="text-sm font-semibold text-gray-700">{row.barangayName}</p>
                  <p className="text-2xl font-bold text-orange-600">{row.count}</p>
                  <p className="text-xs text-gray-500">Total incidents</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

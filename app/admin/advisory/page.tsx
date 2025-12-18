"use client"

import React, { useEffect, useMemo, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Megaphone, Trash2, Clock, CheckCircle2, ArrowLeft, RefreshCw, CalendarClock } from "lucide-react"

interface Advisory {
  id: string
  preset: string | null
  title: string | null
  body: string | null
  expires_at: string | null
  created_at: string | null
  created_by: string | null
}

const PRESETS = [
  { key: 'general', label: 'General Advisory', title: 'Public Advisory', body: 'Please be advised of the following important information from MDRRMO-Bulan.' },
  { key: 'typhoon', label: 'Typhoon Advisory', title: 'Typhoon Advisory', body: 'A typhoon system is expected to affect our area. Stay tuned to official announcements and prepare necessary supplies.' },
  { key: 'flood', label: 'Flood Advisory', title: 'Flood Advisory', body: 'Possible flooding in low-lying areas. Avoid riverbanks and flood-prone zones. Keep updated via official channels.' },
  { key: 'heat', label: 'Heat Advisory', title: 'Heat Advisory', body: 'High temperatures expected. Keep hydrated, avoid prolonged sun exposure, and check on vulnerable individuals.' },
  { key: 'earthquake', label: 'Earthquake Safety', title: 'Earthquake Safety Advisory', body: 'Aftershocks may occur. Drop, Cover, and Hold. Inspect your area for hazards and use only official information.' },
  { key: 'tsunami', label: 'Tsunami Advisory', title: 'Tsunami Advisory', body: 'Coastal communities please be advised. Follow instructions from authorities and stay away from the shoreline if advised.' },
  { key: 'public_safety', label: 'Public Safety Notice', title: 'Public Safety Notice', body: 'For your safety, please follow official guidance. Report emergencies through the MDRRMO app or contact hotlines.' },
]

export default function AdvisoryManagementPage() {
  const router = useRouter()
  const [preset, setPreset] = useState<string>('general')
  const [title, setTitle] = useState<string>('')
  const [body, setBody] = useState<string>('')
  const [expiresAt, setExpiresAt] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [advisories, setAdvisories] = useState<Advisory[]>([])

  // Initialize form based on preset
  useEffect(() => {
    const p = PRESETS.find(p => p.key === preset)
    if (p) {
      if (!title) setTitle(p.title)
      if (!body) setBody(p.body)
    }
  }, [preset])

  const refreshAdvisories = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('advisories')
        .select('id, preset, title, body, expires_at, created_at, created_by')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      setAdvisories((data || []) as Advisory[])
    } catch (e: any) {
      console.error('Load advisories error:', e)
      setError(e?.message || 'Failed to load advisories')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshAdvisories()
    const channel = supabase
      .channel('advisories-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'advisories' }, () => {
        refreshAdvisories()
      })
      .subscribe()
    return () => {
      try { supabase.removeChannel(channel) } catch {}
    }
  }, [refreshAdvisories])

  const onPresetChange = (value: string) => {
    setPreset(value)
    const p = PRESETS.find(p => p.key === value)
    if (p) {
      setTitle(p.title)
      setBody(p.body)
    }
  }

  const onPost = async () => {
    setMessage(null)
    setError(null)
    if (!title.trim() || !body.trim()) {
      setError('Title and body are required.')
      return
    }
    if (!expiresAt) {
      setError('Please set an expiration date/time.')
      return
    }
    try {
      setLoading(true)
      const response = await fetch('/api/advisories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preset,
          title: title.trim(),
          body: body.trim(),
          expiresAt,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        setError(result?.error || 'Failed to post advisory')
        return
      }

      const emailsSent = result?.stats?.emailsSent ?? 0
      const emailsAttempted = result?.stats?.emailsAttempted ?? undefined
      const emailSummary = emailsAttempted !== undefined
        ? ` Emails sent to ${emailsSent} of ${emailsAttempted} users.`
        : ''

      setMessage(`Advisory posted successfully.${emailSummary}`)
      setTitle('')
      setBody('')
      setExpiresAt('')
      setPreset('general')
      await refreshAdvisories()
    } catch (e: any) {
      console.error('Post advisory error:', e)
      setError(e?.message || 'Failed to post advisory')
    } finally {
      setLoading(false)
    }
  }

  const onDelete = async (id: string) => {
    if (!window.confirm('Delete this advisory?')) return
    try {
      const { error: delError } = await supabase.from('advisories').delete().eq('id', id)
      if (delError) throw delError
      await refreshAdvisories()
    } catch (e) {
      console.error(e)
      alert('Failed to delete advisory')
    }
  }

  const onExpireNow = async (id: string) => {
    try {
      const { error: updError } = await supabase.from('advisories').update({ expires_at: new Date().toISOString() }).eq('id', id)
      if (updError) throw updError
      await refreshAdvisories()
    } catch (e) {
      console.error(e)
      alert('Failed to expire advisory')
    }
  }

  const isActive = (a: Advisory) => {
    if (!a.expires_at) return true
    return new Date(a.expires_at).getTime() > Date.now()
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 font-sans text-gray-800">
      <div className="mb-6 flex flex-col gap-4">
        <h1 className="text-3xl font-bold text-gray-800">Advisory Management</h1>
        <div className="w-fit rounded-lg border border-gray-200 bg-white shadow-sm">
          <Button variant="ghost" className="flex items-center gap-2" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </div>
      </div>

      <Card className="mb-6 shadow-lg">
        <CardHeader className="bg-orange-600 text-white rounded-t-lg p-4 flex items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2"><Megaphone className="h-5 w-5" /> Post an Advisory</CardTitle>
          <Button variant="ghost" className="text-white" onClick={refreshAdvisories}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-6 bg-white rounded-b-lg">
          {message && <div className="mb-3 text-green-700">{message}</div>}
          {error && <div className="mb-3 text-red-600">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium mb-1">Preset</div>
              <Select value={preset} onValueChange={onPresetChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a preset" />
                </SelectTrigger>
                <SelectContent>
                  {PRESETS.map(p => (
                    <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Expiration</div>
              <Input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
              <div className="text-xs text-gray-500 mt-1">After expiration, users will see the Welcome card again.</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-sm font-medium mb-1">Title</div>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Advisory title" />
            </div>
            <div className="md:col-span-2">
              <div className="text-sm font-medium mb-1">Body</div>
              <Textarea rows={6} value={body} onChange={e => setBody(e.target.value)} placeholder="Advisory details..." />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={onPost} disabled={loading}>Post Advisory</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader className="bg-orange-600 text-white rounded-t-lg p-4">
          <CardTitle className="text-xl flex items-center gap-2"><CalendarClock className="h-5 w-5" /> Advisory History</CardTitle>
        </CardHeader>
        <CardContent className="p-0 bg-white rounded-b-lg">
          <Table>
            <TableCaption>Recent advisories appear here.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Preset</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6">Loading...</TableCell>
                </TableRow>
              ) : advisories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6">No advisories posted yet.</TableCell>
                </TableRow>
              ) : (
                advisories.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.title || '—'}</TableCell>
                    <TableCell className="text-gray-600">{a.preset || '—'}</TableCell>
                    <TableCell>
                      {isActive(a) ? (
                        <Badge className="bg-green-100 text-green-700 border border-green-300"><CheckCircle2 className="h-3 w-3 mr-1" /> Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-gray-100 text-gray-700 border border-gray-300">Expired</Badge>
                      )}
                    </TableCell>
                    <TableCell>{a.created_at ? new Date(a.created_at).toLocaleString() : '—'}</TableCell>
                    <TableCell>{a.expires_at ? new Date(a.expires_at).toLocaleString() : '—'}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {isActive(a) && (
                        <Button variant="outline" size="sm" onClick={() => onExpireNow(a.id)}>
                          <Clock className="h-4 w-4 mr-1" /> Expire Now
                        </Button>
                      )}
                      <Button variant="destructive" size="sm" onClick={() => onDelete(a.id)}>
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

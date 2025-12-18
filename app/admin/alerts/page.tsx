"use client"

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Trash2, Play, CheckCircle2, UploadCloud, RefreshCw, ArrowLeft } from "lucide-react"

interface FileEntry {
  name: string
  id?: string
  updated_at?: string
  created_at?: string
  last_accessed_at?: string
  metadata?: any
}

export default function AlertManagementPage() {
  const router = useRouter()
  const [files, setFiles] = useState<FileEntry[]>([])
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)
  const [adminIncidentPath, setAdminIncidentPath] = useState<string | null>(null)
  const [userNotificationPath, setUserNotificationPath] = useState<string | null>(null)
  const [userEarthquakePath, setUserEarthquakePath] = useState<string | null>(null)
  const [userTsunamiPath, setUserTsunamiPath] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [uploading, setUploading] = useState<boolean>(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<string | null>(null)

  const refreshList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: list, error: listError } = await supabase
        .storage
        .from('alert_sounds')
        .list('', { limit: 100, sortBy: { column: 'updated_at', order: 'desc' } })
      if (listError) throw listError

      setFiles(list as FileEntry[])

      const { data: settingsData, error: settingsError } = await supabase
        .from('alert_settings')
        .select('active_file_path, admin_incident_sound_path, user_notification_sound_path, user_earthquake_sound_path, user_tsunami_sound_path')
        .order('updated_at', { ascending: false })
        .limit(1)
      if (settingsError) {
        if ((settingsError as any).code !== 'PGRST116') {
          console.warn('Error loading alert settings:', settingsError)
        }
      } else if (settingsData && settingsData.length > 0) {
        setActiveFilePath(settingsData[0].active_file_path)
        setAdminIncidentPath(settingsData[0].admin_incident_sound_path || null)
        setUserNotificationPath(settingsData[0].user_notification_sound_path || null)
        setUserEarthquakePath(settingsData[0].user_earthquake_sound_path || null)
        setUserTsunamiPath(settingsData[0].user_tsunami_sound_path || null)
      } else {
        setActiveFilePath(null)
        setAdminIncidentPath(null)
        setUserNotificationPath(null)
        setUserEarthquakePath(null)
        setUserTsunamiPath(null)
      }
    } catch (e: any) {
      console.error(e)
      setError(e.message || 'Failed to load files')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshList()
    const channel = supabase
      .channel('alert-settings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alert_settings' }, () => {
        refreshList()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refreshList])

  const onUpload = async (evt: React.ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0]
    if (!file) return
    setMessage(null)
    setError(null)

    const fileExt = file.name.split('.').pop()?.toLowerCase()
    if (!fileExt || !['mp3', 'wav'].includes(fileExt)) {
      setError('Only .mp3 or .wav files are allowed.')
      return
    }

    setUploading(true)
    try {
      const timestamp = Date.now()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `admin-${timestamp}-${safeName}`

      const { error: uploadError } = await supabase
        .storage
        .from('alert_sounds')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || (fileExt === 'mp3' ? 'audio/mpeg' : 'audio/wav')
        })
      if (uploadError) throw uploadError

      setMessage('File uploaded successfully.')
      await refreshList()
    } catch (e: any) {
      console.error('Upload error:', e)
      setError(e.message || 'Failed to upload file')
    } finally {
      setUploading(false)
      if (evt.target) evt.target.value = ''
    }
  }

  const upsertAlertSettings = async (values: Record<string, any>) => {
    const { data: settingsData, error: settingsError } = await supabase
      .from('alert_settings')
      .select('id')
      .order('updated_at', { ascending: false })
      .limit(1)

    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData?.session?.user?.id || null

    if (settingsError && (settingsError as any).code !== 'PGRST116') {
      throw settingsError
    }

    if (settingsData && settingsData.length > 0) {
      const id = settingsData[0].id
      const { error: updateError } = await supabase
        .from('alert_settings')
        .update({ ...values, updated_by: userId, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (updateError) throw updateError
    } else {
      const { error: insertError } = await supabase
        .from('alert_settings')
        .insert({ ...values, updated_by: userId, updated_at: new Date().toISOString() })
      if (insertError) throw insertError
    }
  }

  const toggleLegacy = async (nextValue: string | null) => {
    setError(null)
    setMessage(null)
    try {
      if (nextValue === null) {
        if (!window.confirm('Remove the legacy alert sound assignment?')) return
      }
      await upsertAlertSettings({ active_file_path: nextValue })
      setMessage(nextValue ? 'Legacy alert sound set.' : 'Legacy alert sound cleared.')
      await refreshList()
    } catch (e: any) {
      console.error('Toggle legacy error:', e)
      setError(e.message || 'Failed to update legacy sound')
    }
  }

  const toggleCategory = async (
    field: 'admin_incident_sound_path' | 'user_notification_sound_path' | 'user_earthquake_sound_path' | 'user_tsunami_sound_path',
    nextValue: string | null
  ) => {
    const labelMap: Record<typeof field, string> = {
      admin_incident_sound_path: 'Admin Incident',
      user_notification_sound_path: 'User Notification',
      user_earthquake_sound_path: 'User Earthquake',
      user_tsunami_sound_path: 'User Tsunami',
    }
    setError(null)
    setMessage(null)
    try {
      if (nextValue === null) {
        if (!window.confirm(`Remove the ${labelMap[field]} sound assignment?`)) return
      }
      await upsertAlertSettings({ [field]: nextValue })
      setMessage(nextValue ? `${labelMap[field]} sound set.` : `${labelMap[field]} sound cleared.`)
      await refreshList()
    } catch (e: any) {
      console.error('Toggle category error:', e)
      setError(e.message || 'Failed to update sound assignment')
    }
  }

  const onDelete = async (name: string) => {
    setError(null)
    setMessage(null)
    try {
      if (name === activeFilePath) {
        setError('Cannot delete the currently active alert sound. Set a different active sound first.')
        return
      }
      const { error: delError } = await supabase
        .storage
        .from('alert_sounds')
        .remove([name])
      if (delError) throw delError
      setMessage('File deleted.')
      await refreshList()
    } catch (e: any) {
      console.error('Delete error:', e)
      setError(e.message || 'Failed to delete file')
    }
  }

  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

  const onPreview = async (name: string) => {
    setPreviewing(name)
    try {
      const { data, error: urlError } = await supabase
        .storage
        .from('alert_sounds')
        .createSignedUrl(name, 60)
      if (urlError || !data?.signedUrl) throw urlError || new Error('Unable to create signed URL')

      if (!previewAudioRef.current) {
        previewAudioRef.current = new Audio()
      }

      previewAudioRef.current.src = data.signedUrl
      previewAudioRef.current.currentTime = 0
      await previewAudioRef.current.load()
      await previewAudioRef.current.play().catch((err: any) => {
        console.warn('Autoplay blocked, user interaction may be required:', err)
      })
    } catch (e) {
      console.error(e)
    } finally {
      setPreviewing(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 font-sans text-gray-800">
      <div className="mb-6 flex flex-col gap-4">
        <h1 className="text-3xl font-bold text-gray-800">Alert Sound Management</h1>
        <div className="w-fit rounded-lg border border-gray-200 bg-white shadow-sm">
          <Button
            variant="ghost"
            className="flex items-center gap-2"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </div>
      </div>
      <Card className="mb-6 shadow-lg">
        <CardHeader className="bg-orange-600 text-white rounded-t-lg p-4 flex items-center justify-between">
          <CardTitle className="text-xl">Upload Alert Sound</CardTitle>
          <Button variant="ghost" className="text-white" onClick={refreshList}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-6 bg-white rounded-b-lg">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Input type="file" accept="audio/mpeg,audio/wav" onChange={onUpload} disabled={uploading} />
            <Button disabled={uploading} onClick={() => {}} className="hidden sm:inline-flex">
              <UploadCloud className="h-4 w-4 mr-2" /> Upload
            </Button>
          </div>
          <p className="text-sm text-gray-600 mt-2">Allowed formats: .mp3, .wav</p>
          {message && <div className="mt-3 text-green-700">{message}</div>}
          {error && <div className="mt-3 text-red-600">{error}</div>}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader className="bg-orange-600 text-white rounded-t-lg p-4">
          <CardTitle className="text-xl">Available Sounds</CardTitle>
        </CardHeader>
        <CardContent className="p-0 bg-white rounded-b-lg">
          <Table>
            <TableCaption>Hi Admin! Feel Free to Modify the Alert Sounds!</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-6">Loading...</TableCell>
                </TableRow>
              ) : files.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-6">No files uploaded yet.</TableCell>
                </TableRow>
              ) : (
                files.map((f) => (
                  <TableRow key={f.name}>
                    <TableCell>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{f.name}</span>
                        {activeFilePath === f.name && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 border border-green-300">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Legacy Active
                          </Badge>
                        )}
                        {adminIncidentPath === f.name && (
                          <Badge variant="secondary" className="bg-red-100 text-red-700 border border-red-300">Admin Incident Active</Badge>
                        )}
                        {userNotificationPath === f.name && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 border border-blue-300">User Notification Active</Badge>
                        )}
                        {userEarthquakePath === f.name && (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 border border-yellow-300">Earthquake Active</Badge>
                        )}
                        {userTsunamiPath === f.name && (
                          <Badge variant="secondary" className="bg-cyan-100 text-cyan-700 border border-cyan-300">Tsunami Active</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{f.updated_at ? new Date(f.updated_at).toLocaleString() : '—'}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => onPreview(f.name)} disabled={previewing === f.name}>
                        <Play className="h-4 w-4 mr-1" /> Preview
                      </Button>
                      <Button
                        variant={activeFilePath === f.name ? 'outline' : 'secondary'}
                        size="sm"
                        onClick={() => toggleLegacy(activeFilePath === f.name ? null : f.name)}
                      >
                        {activeFilePath === f.name ? 'Clear Legacy' : 'Set Legacy'}
                      </Button>
                      <Button
                        variant={adminIncidentPath === f.name ? 'outline' : 'secondary'}
                        size="sm"
                        onClick={() => toggleCategory('admin_incident_sound_path', adminIncidentPath === f.name ? null : f.name)}
                      >
                        {adminIncidentPath === f.name ? 'Clear Admin Incident' : 'Set Admin Incident'}
                      </Button>
                      <Button
                        variant={userNotificationPath === f.name ? 'outline' : 'secondary'}
                        size="sm"
                        onClick={() => toggleCategory('user_notification_sound_path', userNotificationPath === f.name ? null : f.name)}
                      >
                        {userNotificationPath === f.name ? 'Clear User Notification' : 'Set User Notification'}
                      </Button>
                      <Button
                        variant={userEarthquakePath === f.name ? 'outline' : 'secondary'}
                        size="sm"
                        onClick={() => toggleCategory('user_earthquake_sound_path', userEarthquakePath === f.name ? null : f.name)}
                      >
                        {userEarthquakePath === f.name ? 'Clear Earthquake' : 'Set Earthquake'}
                      </Button>
                      <Button
                        variant={userTsunamiPath === f.name ? 'outline' : 'secondary'}
                        size="sm"
                        onClick={() => toggleCategory('user_tsunami_sound_path', userTsunamiPath === f.name ? null : f.name)}
                      >
                        {userTsunamiPath === f.name ? 'Clear Tsunami' : 'Set Tsunami'}
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => onDelete(f.name)}>
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
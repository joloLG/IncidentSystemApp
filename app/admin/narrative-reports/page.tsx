"use client"

import React from "react"
import useSWR from "swr"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { ArrowLeft, Filter, ImagePlus, Loader2, Search, Upload, XCircle } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"

interface NarrativeReport {
  id: string
  internal_report_id: number | null
  title: string
  narrative_text: string
  image_url: string | null
  status: "draft" | "published" | "archived"
  created_at: string
  updated_at: string
  published_at: string | null
  divisions: string[]
}

interface NarrativeQueryParams {
  status: "draft" | "published"
  page: number
  search: string
}

interface NarrativeFetcherKey extends NarrativeQueryParams {
  key: string
}

const PAGE_SIZE = 10

const fetchNarratives = async (params: NarrativeQueryParams) => {
  const { status, page, search } = params
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from("narrative_reports")
    .select("id, internal_report_id, title, narrative_text, image_url, status, created_at, updated_at, published_at, divisions", {
      count: "exact",
    })
    .eq("status", status)
    .order(status === "draft" ? "created_at" : "published_at", { ascending: false, nullsFirst: true })
    .range(from, to)

  if (search.trim()) {
    const term = search.trim()
    query = query.or(`title.ilike.%${term}%,narrative_text.ilike.%${term}%`)
  }

  const { data, error, count } = await query

  if (error) {
    throw new Error(error.message)
  }

  return {
    records: (data as NarrativeReport[]) || [],
    total: count ?? 0,
  }
}

export default function NarrativeReportsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = React.useState<"draft" | "published">("draft")
  const [searchDrafts, setSearchDrafts] = React.useState("")
  const [searchPublished, setSearchPublished] = React.useState("")
  const [draftPage, setDraftPage] = React.useState(1)
  const [publishedPage, setPublishedPage] = React.useState(1)
  const [selectedReport, setSelectedReport] = React.useState<NarrativeReport | null>(null)
  const [previewImage, setPreviewImage] = React.useState<string | null>(null)
  const [imageFile, setImageFile] = React.useState<File | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const [isPublishing, setIsPublishing] = React.useState(false)

  const fetchKey = React.useMemo<NarrativeFetcherKey>(() => ({
    key: "narratives",
    status: activeTab,
    page: activeTab === "draft" ? draftPage : publishedPage,
    search: activeTab === "draft" ? searchDrafts : searchPublished,
  }), [activeTab, draftPage, publishedPage, searchDrafts, searchPublished])

  const { data, error, isLoading, mutate } = useSWR(fetchKey, () =>
    fetchNarratives({
      status: fetchKey.status,
      page: fetchKey.page,
      search: fetchKey.search,
    }),
  )

  const records = data?.records ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const resetSelection = () => {
    setSelectedReport(null)
    setPreviewImage(null)
    setImageFile(null)
  }

  const handleSelect = (report: NarrativeReport) => {
    setSelectedReport(report)
    setPreviewImage(report.image_url)
    setImageFile(null)
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast({
        variant: "destructive",
        title: "Unsupported file",
        description: "Please upload an image file.",
      })
      return
    }
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      setPreviewImage(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setPreviewImage(null)
  }

  const uploadImageIfNeeded = async (reportId: string) => {
    if (!imageFile) {
      return selectedReport?.image_url ?? null
    }

    setIsUploading(true)
    try {
      const fileExt = imageFile.name.split(".").pop()
      const filePath = `narratives/${reportId}-${Date.now()}.${fileExt}`
      const { data: storageData, error: storageError } = await supabase.storage
        .from("narrative-images")
        .upload(filePath, imageFile, {
          cacheControl: "3600",
          upsert: true,
        })

      if (storageError) throw storageError

      const { data: urlData } = supabase.storage
        .from("narrative-images")
        .getPublicUrl(storageData?.path ?? filePath)

      return urlData.publicUrl
    } finally {
      setIsUploading(false)
    }
  }

  const handlePublish = async () => {
    if (!selectedReport) return
    try {
      setIsPublishing(true)
      const imageUrl = await uploadImageIfNeeded(selectedReport.id)
      const { error: updateError } = await supabase
        .from("narrative_reports")
        .update({
          image_url: imageUrl,
          title: selectedReport.title,
          narrative_text: selectedReport.narrative_text,
          divisions: selectedReport.divisions,
          status: "published",
          published_at: new Date().toISOString(),
        })
        .eq("id", selectedReport.id)

      if (updateError) throw updateError

      toast({ title: "Narrative published", description: "The narrative is now visible to users." })
      resetSelection()
      setActiveTab("published")
      setPublishedPage(1)
      await mutate()
    } catch (err: any) {
      console.error("Publish narrative error", err)
      toast({
        variant: "destructive",
        title: "Failed to publish",
        description: err?.message ?? "Please try again.",
      })
    } finally {
      setIsPublishing(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!selectedReport) return
    try {
      setIsPublishing(true)
      const imageUrl = await uploadImageIfNeeded(selectedReport.id)
      const { error: updateError } = await supabase
        .from("narrative_reports")
        .update({
          image_url: imageUrl,
          title: selectedReport.title,
          narrative_text: selectedReport.narrative_text,
          divisions: selectedReport.divisions,
        })
        .eq("id", selectedReport.id)

      if (updateError) throw updateError

      toast({ title: "Draft updated", description: "Draft saved with latest changes." })
      await mutate()
    } catch (err: any) {
      console.error("Save draft error", err)
      toast({
        variant: "destructive",
        title: "Failed to save draft",
        description: err?.message ?? "Please try again.",
      })
    } finally {
      setIsPublishing(false)
    }
  }

  const currentSearch = activeTab === "draft" ? searchDrafts : searchPublished
  const currentPage = activeTab === "draft" ? draftPage : publishedPage

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 font-sans text-gray-800">
      <div className="mb-6 flex flex-col gap-4">
        <h1 className="text-3xl font-bold text-gray-800">Narrative Reports</h1>
        <div className="flex justify-start">
          <Button
            variant="outline"
            onClick={() => router.push("/")}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </div>
        <p className="text-sm text-gray-600 max-w-2xl">
          Manage internal report narratives: review drafts, add cover images, and publish to the MDRRMO Incident Posts feed.
        </p>
      </div>

      <Card className="shadow-lg rounded-lg">
        <CardHeader className="bg-orange-600 text-white rounded-t-lg p-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Filter className="h-5 w-5" /> Narrative Management
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 bg-white rounded-b-lg">
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              const tab = value as "draft" | "published"
              setActiveTab(tab)
              if (tab === "draft") {
                setDraftPage(1)
              } else {
                setPublishedPage(1)
              }
            }}
          >
            <TabsList className="grid grid-cols-2 bg-orange-50">
              <TabsTrigger
                value="draft"
                className="data-[state=active]:bg-white data-[state=active]:text-orange-600"
              >
                Drafts
              </TabsTrigger>
              <TabsTrigger
                value="published"
                className="data-[state=active]:bg-white data-[state=active]:text-orange-600"
              >
                Published
              </TabsTrigger>
            </TabsList>
            <TabsContent value="draft">
              <NarrativeList
                status="draft"
                records={records}
                total={total}
                isLoading={isLoading}
                error={error}
                search={searchDrafts}
                onSearchChange={(value) => {
                  setSearchDrafts(value)
                  setDraftPage(1)
                }}
                page={draftPage}
                totalPages={totalPages}
                onPageChange={setDraftPage}
                onSelect={handleSelect}
                selectedId={selectedReport?.id ?? null}
              />
            </TabsContent>
            <TabsContent value="published">
              <NarrativeList
                status="published"
                records={records}
                total={total}
                isLoading={isLoading}
                error={error}
                search={searchPublished}
                onSearchChange={(value) => {
                  setSearchPublished(value)
                  setPublishedPage(1)
                }}
                page={publishedPage}
                totalPages={totalPages}
                onPageChange={setPublishedPage}
                onSelect={handleSelect}
                selectedId={selectedReport?.id ?? null}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-5 gap-6">
        <Card className="shadow-lg rounded-lg xl:col-span-3">
          <CardHeader className="bg-orange-600 text-white rounded-t-lg p-3">
            <CardTitle className="text-lg font-semibold">Preview & Edit Narrative</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4 bg-white rounded-b-lg">
            {selectedReport ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-semibold text-gray-700">Title</Label>
                  <Input
                    value={selectedReport.title}
                    onChange={(event) => setSelectedReport((prev) => (prev ? { ...prev, title: event.target.value } : prev))}
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-gray-700">Narrative Details</Label>
                  <Textarea
                    value={selectedReport.narrative_text}
                    onChange={(event) =>
                      setSelectedReport((prev) => (prev ? { ...prev, narrative_text: event.target.value } : prev))
                    }
                    rows={10}
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-gray-700">Divisions Involved</Label>
                  <Input
                    value={selectedReport.divisions ? selectedReport.divisions.join(", ") : ""}
                    onChange={(event) =>
                      setSelectedReport((prev) => (prev ? { ...prev, divisions: event.target.value.split(",").map(s => s.trim()).filter(s => s) } : prev))
                    }
                    placeholder="e.g. Fire Department, Medical Team"
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter divisions separated by commas</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700">Cover Image</Label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <label className="flex items-center gap-2 border border-dashed border-gray-300 rounded-md px-4 py-3 cursor-pointer hover:border-orange-400">
                      <ImagePlus className="h-5 w-5 text-orange-500" />
                      <span className="text-sm font-medium text-gray-700">Upload image</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    </label>
                    {previewImage ? (
                      <div className="relative">
                        <img
                          src={previewImage}
                          alt="Preview"
                          className="h-32 w-48 object-cover rounded-md border border-gray-200"
                        />
                        <button
                          onClick={handleRemoveImage}
                          className="absolute -top-2 -right-2 bg-white rounded-full shadow p-1"
                          title="Remove image"
                        >
                          <XCircle className="h-4 w-4 text-red-500" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No image selected</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">Images appear above the narrative when posted.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={resetSelection}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveDraft} disabled={isUploading || isPublishing}>
                    {isPublishing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Save Draft
                  </Button>
                  <Button
                    onClick={handlePublish}
                    disabled={selectedReport.status !== "draft" || isUploading || isPublishing}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {isPublishing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    Publish to Users
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center text-gray-500 gap-3 min-h-[200px]">
                <Filter className="h-12 w-12 text-orange-300" />
                <p>Select a narrative to view or edit details.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg rounded-lg xl:col-span-2">
          <CardHeader className="bg-orange-600 text-white rounded-t-lg p-3">
            <CardTitle className="text-lg font-semibold">Selected Narrative Info</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4 bg-white rounded-b-lg">
            {selectedReport ? (
              <div className="space-y-3 text-sm text-gray-700">
                <div className="flex items-center justify-between">
                  <span>Status</span>
                  <Badge variant="outline" className="capitalize border-orange-200 text-orange-700 bg-orange-50">
                    {selectedReport.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Created</span>
                  <span>{formatDistanceToNow(new Date(selectedReport.created_at), { addSuffix: true })}</span>
                </div>
                {selectedReport.published_at ? (
                  <div className="flex items-center justify-between">
                    <span>Published</span>
                    <span>{new Date(selectedReport.published_at).toLocaleString()}</span>
                  </div>
                ) : null}
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-gray-800">Narrative Preview</span>
                  <div className="whitespace-pre-wrap text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md p-3">
                    {selectedReport.narrative_text}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Select a narrative from the list to view its details.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

interface NarrativeListProps {
  status: "draft" | "published"
  records: NarrativeReport[]
  total: number
  isLoading: boolean
  error: Error | undefined
  search: string
  onSearchChange: (value: string) => void
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  onSelect: (report: NarrativeReport) => void
  selectedId: string | null
}

function NarrativeList({
  status,
  records,
  isLoading,
  error,
  search,
  onSearchChange,
  page,
  totalPages,
  onPageChange,
  onSelect,
  selectedId,
}: NarrativeListProps) {
  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={`Search ${status === "draft" ? "draft" : "published"} narratives...`}
            className="pl-9"
          />
        </div>
        <div className="text-sm text-gray-500">
          Showing {records.length} of {totalPages === 0 ? 0 : totalPages * PAGE_SIZE}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-gray-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading narratives...
        </div>
      ) : error ? (
        <div className="p-4 border border-red-200 bg-red-50 text-red-600 rounded-md">
          Failed to load narratives: {error.message}
        </div>
      ) : records.length === 0 ? (
        <div className="p-6 border border-dashed border-gray-300 rounded-md text-center text-sm text-gray-500">
          No narratives found for this filter.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Internal Report</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => {
                const isActive = selectedId === record.id
                return (
                  <TableRow
                    key={record.id}
                    className={`cursor-pointer ${isActive ? "bg-orange-50" : "hover:bg-gray-50"}`}
                    onClick={() => onSelect(record)}
                  >
                    <TableCell className="font-medium text-gray-800">
                      <div className="flex flex-col">
                        <span>{record.title}</span>
                        <span className="text-xs text-gray-500 truncate max-w-md">{record.narrative_text}</span>
                      </div>
                    </TableCell>
                    <TableCell>{record.internal_report_id ?? "—"}</TableCell>
                    <TableCell>{formatDistanceToNow(new Date(record.updated_at), { addSuffix: true })}</TableCell>
                    <TableCell>
                      <Badge className="capitalize" variant={record.status === "draft" ? "secondary" : "default"}>
                        {record.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <PaginationControls page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  )
}

interface PaginationControlsProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

function PaginationControls({ page, totalPages, onPageChange }: PaginationControlsProps) {
  const canPrev = page > 1
  const canNext = page < totalPages

  return (
    <div className="flex items-center justify-center gap-3 py-4">
      <Button variant="outline" size="sm" disabled={!canPrev} onClick={() => onPageChange(page - 1)}>
        Previous
      </Button>
      <span className="text-sm text-gray-600">
        Page {page} of {totalPages}
      </span>
      <Button variant="outline" size="sm" disabled={!canNext} onClick={() => onPageChange(page + 1)}>
        Next
      </Button>
    </div>
  )
}

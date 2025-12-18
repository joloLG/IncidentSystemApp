"use client"

import React from "react"
import useSWR from "swr"
import { formatDistanceToNow } from "date-fns"
import { useRouter } from "next/navigation"
import { Loader2, Search, Heart } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface PublishedNarrative {
  id: string
  title: string
  narrative_text: string
  image_url: string | null
  internal_report_id: number | null
  published_at: string | null
  created_at: string
  divisions: string[]
  likes_count: number
  user_liked: boolean
}

interface FetchParams {
  page: number
  search: string
}

interface FetchResponse {
  records: PublishedNarrative[]
  total: number
}

const PAGE_SIZE = 10

const fetchPublishedNarratives = async ({ page, search }: FetchParams): Promise<FetchResponse> => {
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from("narrative_reports")
    .select("id, title, narrative_text, image_url, internal_report_id, published_at, created_at, divisions", { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(from, to)

  if (search.trim()) {
    const term = search.trim()
    query = query.or(`title.ilike.%${term}%,narrative_text.ilike.%${term}%`)
  }

  const { data: postsData, error: postsError, count } = await query

  if (postsError) {
    throw new Error(postsError.message)
  }

  if (!postsData || postsData.length === 0) {
    return {
      records: [],
      total: count ?? 0,
    }
  }

  // Get current user
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id

  // Get likes count for each post
  const postIds = postsData.map(post => post.id)
  const { data: likesData, error: likesError } = await supabase
    .from("post_likes")
    .select("post_id, user_id")
    .in("post_id", postIds)

  if (likesError) {
    console.error("Error fetching likes:", likesError)
  }

  // Process likes data
  const likesMap = new Map<string, { count: number; userLiked: boolean }>()
  if (likesData) {
    likesData.forEach(like => {
      const existing = likesMap.get(like.post_id) || { count: 0, userLiked: false }
      existing.count++
      if (like.user_id === userId) {
        existing.userLiked = true
      }
      likesMap.set(like.post_id, existing)
    })
  }

  // Combine data
  const processedData = postsData.map(post => {
    const likes = likesMap.get(post.id) || { count: 0, userLiked: false }
    return {
      ...post,
      likes_count: likes.count,
      user_liked: likes.userLiked,
    }
  })

  return {
    records: processedData as PublishedNarrative[],
    total: count ?? 0,
  }
}

export default function IncidentPostsPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = React.useState("")
  const deferredSearch = React.useDeferredValue(searchTerm)
  const [page, setPage] = React.useState(1)

  const { data, error, isLoading, mutate } = useSWR({ key: "incident-posts", page, search: deferredSearch }, () =>
    fetchPublishedNarratives({ page, search: deferredSearch }),
  )

  const records = data?.records ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleLike = async (postId: string, currentlyLiked: boolean) => {
    try {
      if (currentlyLiked) {
        // Unlike
        const { error } = await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", (await supabase.auth.getUser()).data.user?.id)

        if (error) throw error
      } else {
        // Like
        const { error } = await supabase
          .from("post_likes")
          .insert({
            post_id: postId,
            user_id: (await supabase.auth.getUser()).data.user?.id,
          })

        if (error) throw error
      }

      // Refresh data
      await mutate()
    } catch (error) {
      console.error("Error toggling like:", error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 font-sans text-gray-800">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">MDRRMO Incident Posts</h1>
            <p className="text-sm text-gray-600">Stay updated with the latest incident narratives from MDRRMO Bulan.</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search incident posts..."
            className="pl-9 bg-white shadow-sm"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading posts...
          </div>
        ) : error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            Failed to load incident posts: {error.message}
          </div>
        ) : records.length === 0 ? (
          <div className="rounded-md border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
            No incident posts found.
          </div>
        ) : (
          <div className="space-y-6">
            {records.map((record) => (
              <Card key={record.id} className="overflow-hidden shadow-md">
                <CardHeader className="bg-white pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-xl font-semibold text-gray-900 break-words">
                      MDRRMO BULAN
                    </CardTitle>
                    <Badge variant="outline" className="shrink-0 border-orange-200 bg-orange-50 text-orange-700">
                      {record.internal_report_id ? `Report #${record.internal_report_id}` : "Incident"}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500">
                    {record.published_at
                      ? `Published ${formatDistanceToNow(new Date(record.published_at), { addSuffix: true })}`
                      : `Created ${formatDistanceToNow(new Date(record.created_at), { addSuffix: true })}`}
                  </p>
                  {record.divisions && record.divisions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {record.divisions.map((division, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {division}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-3 bg-white">
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700">
                    {record.narrative_text}
                  </p>
                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLike(record.id, record.user_liked)}
                      className={`flex items-center gap-1 ${record.user_liked ? 'text-red-500' : 'text-gray-500'}`}
                    >
                      <Heart className={`h-4 w-4 ${record.user_liked ? 'fill-current' : ''}`} />
                      {record.likes_count}
                    </Button>
                    <div className="text-xs text-gray-500">
                      Last updated {formatDistanceToNow(new Date(record.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </CardContent>
                {record.image_url ? (
                  <div className="relative w-full overflow-hidden bg-gray-200">
                    <img
                      src={record.image_url}
                      alt={record.title}
                      className="w-full object-cover"
                      style={{ maxHeight: 280 }}
                    />
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        )}

        <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} disabled={isLoading} />

        <div className="flex justify-center">
          <Button variant="outline" onClick={() => router.push("/")} className="text-gray-700">
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  disabled?: boolean
}

function PaginationControls({ page, totalPages, onPageChange, disabled }: PaginationProps) {
  const canPrev = page > 1
  const canNext = page < totalPages

  return (
    <div className="flex items-center justify-center gap-3 py-4">
      <Button variant="outline" size="sm" disabled={disabled || !canPrev} onClick={() => onPageChange(page - 1)}>
        Previous
      </Button>
      <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
      <Button variant="outline" size="sm" disabled={disabled || !canNext} onClick={() => onPageChange(page + 1)}>
        Next
      </Button>
    </div>
  )
}

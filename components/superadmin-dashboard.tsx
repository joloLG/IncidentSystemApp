"use client"

import { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2, LogOut, Info, CheckCircle, XCircle, Clock } from "lucide-react" // Removed Ban, CheckCircle, CalendarIcon
import { userQueries, hospitalQueries, erTeamQueries, type User, type Hospital, type ErTeam, supabase } from "@/lib/supabase"
import { robustSignOut } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

// Removed isBanning, tempBanUntil, tempBanReason as they are no longer used for UI interaction
type UserWithDisplayInfo = Omit<User, 'user_type'> & {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  mobileNumber?: string;
  user_type: User['user_type'];
  created_at: string;
  isUpdating?: boolean; // Kept for role updates
}

export function SuperadminDashboard({ onLogoutAction }: { onLogoutAction: () => Promise<void> }) {
  const handleLogout = async () => {
    try {
      await robustSignOut()
      if (typeof onLogoutAction === 'function') {
        await onLogoutAction()
      }
    } finally {
      window.location.href = "/"
    }
  }

  const [users, setUsers] = useState<UserWithDisplayInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Ban modal state
  const [showBanModal, setShowBanModal] = useState(false)
  const [banTarget, setBanTarget] = useState<UserWithDisplayInfo | null>(null)
  const [banType, setBanType] = useState<'temporary' | 'permanent'>('temporary')
  const [banDays, setBanDays] = useState<string>('7')
  const [banReason, setBanReason] = useState<string>('')
  const [isSubmittingBan, setIsSubmittingBan] = useState(false)
  const [banError, setBanError] = useState<string | null>(null)

  // Unban modal state
  const [showUnbanModal, setShowUnbanModal] = useState(false)
  const [unbanTarget, setUnbanTarget] = useState<UserWithDisplayInfo | null>(null)
  const [unbanReason, setUnbanReason] = useState<string>('')
  const [isSubmittingUnban, setIsSubmittingUnban] = useState(false)
  const [unbanError, setUnbanError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | User['user_type']>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'banned'>('all')
  const PAGE_SIZE = 15
  const [currentPage, setCurrentPage] = useState(1)
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [hospitalAssignments, setHospitalAssignments] = useState<Record<string, string | null>>({})
  const [erTeams, setErTeams] = useState<ErTeam[]>([])
  const [erTeamAssignments, setErTeamAssignments] = useState<Record<string, number | null>>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserName, setCurrentUserName] = useState<string>("Superadmin")
  const [greetingMessage, setGreetingMessage] = useState<string>("")
  const [currentDateTime, setCurrentDateTime] = useState<string>("")

  // Approval requests state
  type ApprovalRequest = {
    id: string
    user_id: string
    requested_role: 'admin' | 'hospital' | 'er_team'
    requested_at: string
    reviewed_at?: string
    reviewed_by?: string
    status: 'pending' | 'approved' | 'rejected'
    notes?: string | null
    hospital_id?: string
    er_team_id?: number
    er_team?: {
      name: string
    }
    user?: {
      firstName: string
      lastName: string
      email: string
      mobileNumber?: string
    }
    isSynthetic?: boolean
  }
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([])
  const [isLoadingApprovals, setIsLoadingApprovals] = useState(false)
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')

  // Approval action dialogs
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [approvalTarget, setApprovalTarget] = useState<ApprovalRequest | null>(null)
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve')
  const [approvalNotes, setApprovalNotes] = useState('')
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false)

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  // Fetch all users
  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const data = await userQueries.getAllUsers()
      setUsers(data.map(user => ({
        ...user,
        isUpdating: false,
      })))
    } catch (err) {
      console.error("Error fetching users:", err)
      setError("Failed to load users. Please try again later.")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchHospitalsAndAssignments = async () => {
    try {
      const [hospitalList, assignments] = await Promise.all([
        hospitalQueries.getHospitals(),
        hospitalQueries.getHospitalAssignments(),
      ])
      setHospitals(hospitalList)
      const assignmentMap: Record<string, string | null> = {}
      assignments.forEach((item) => {
        assignmentMap[item.user_id] = item.hospital_id
      })
      setHospitalAssignments(assignmentMap)
    } catch (err) {
      console.error("Error fetching hospitals/assignments:", err)
    }
  }

  const fetchApprovalRequests = async () => {
    try {
      setIsLoadingApprovals(true)
      const [requestsResult, pendingUsersResult] = await Promise.all([
        supabase
          .from('admin_approval_requests')
          .select(`
            *,
            user:user_id (
              firstName,
              lastName,
              email,
              mobileNumber
            ),
            er_team:er_team_id (
              name
            )
          `)
          .order('requested_at', { ascending: false }),
        supabase
          .from('users')
          .select('id, firstName, lastName, email, mobileNumber, status, requested_role, created_at')
          .in('status', ['pending_admin', 'pending_hospital', 'pending_er_team'])
      ])

      if (requestsResult.error) throw requestsResult.error
      if (pendingUsersResult.error) throw pendingUsersResult.error

      const fetchedRequests = (requestsResult.data || []) as ApprovalRequest[]
      const existingUserIds = new Set(fetchedRequests.map((req) => req.user_id))

      const syntheticRequests = (pendingUsersResult.data || [])
        .filter((pendingUser) => !existingUserIds.has(pendingUser.id))
        .map<ApprovalRequest>((pendingUser) => {
          const requestedRole = pendingUser.requested_role === 'hospital' || pendingUser.status === 'pending_hospital'
            ? 'hospital'
            : pendingUser.requested_role === 'er_team' || pendingUser.status === 'pending_er_team'
              ? 'er_team'
              : 'admin'

          return {
            id: `pending-${pendingUser.id}`,
            user_id: pendingUser.id,
            requested_role: requestedRole,
            requested_at: pendingUser.created_at ?? new Date().toISOString(),
            status: 'pending',
            notes: null,
            isSynthetic: true,
            user: {
              firstName: pendingUser.firstName,
              lastName: pendingUser.lastName,
              email: pendingUser.email,
              mobileNumber: pendingUser.mobileNumber ?? undefined,
            },
          }
        })

      const combinedRequests = [...fetchedRequests, ...syntheticRequests].sort((a, b) =>
        new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
      )

      setApprovalRequests(combinedRequests)
    } catch (err) {
      console.error("Error fetching approval requests:", err)
      setError("Failed to load approval requests. Please try again later.")
    } finally {
      setIsLoadingApprovals(false)
    }
  }

  const handleApprovalAction = async (requestId: string, action: 'approve' | 'reject', notes?: string) => {
    try {
      const existingRequest = approvalRequests.find(r => r.id === requestId)
      if (!existingRequest) return

      let workingRequest: ApprovalRequest = existingRequest

      // If this is a synthetic request, create a formal record first
      if (existingRequest.isSynthetic) {
        const hospitalId = existingRequest.requested_role === 'hospital'
          ? hospitalAssignments[existingRequest.user_id] ?? null
          : null
        const erTeamId = existingRequest.requested_role === 'er_team'
          ? erTeamAssignments[existingRequest.user_id] ?? null
          : null

        const { data: createdRequest, error: createError } = await supabase
          .from('admin_approval_requests')
          .insert({
            user_id: existingRequest.user_id,
            requested_role: existingRequest.requested_role,
            status: 'pending',
            hospital_id: hospitalId,
            er_team_id: erTeamId,
            notes: notes || null,
          })
          .select(`
            *,
            user:user_id (
              firstName,
              lastName,
              email,
              mobileNumber
            ),
            er_team:er_team_id (
              name
            )
          `)
          .single()

        if (createError || !createdRequest) throw createError

        workingRequest = {
          ...createdRequest,
          isSynthetic: false,
        }
      }

      const { data: authUser } = await supabase.auth.getUser()

      const targetRequestId = workingRequest.id

      // Update the approval request with the chosen action
      const { error: updateError } = await supabase
        .from('admin_approval_requests')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: authUser?.user?.id ?? null,
          notes: notes || null
        })
        .eq('id', targetRequestId)

      if (updateError) throw updateError

      // If approving, update the user's status and role
      if (action === 'approve') {
        const isHospitalRequest = workingRequest.requested_role === 'hospital'
        const isErTeamRequest = workingRequest.requested_role === 'er_team'
        const userType = isHospitalRequest ? 'hospital' : isErTeamRequest ? 'er_team' : 'admin'
        const status = 'active'

        const { error: userUpdateError } = await supabase
          .from('users')
          .update({
            user_type: userType,
            status: status,
            requested_role: null,
          })
          .eq('id', workingRequest.user_id)

        if (userUpdateError) throw userUpdateError

        // If hospital request, assign hospital automatically
        if (isHospitalRequest) {
          const hospitalId = workingRequest.hospital_id || hospitalAssignments[workingRequest.user_id] || null
          if (hospitalId) {
            try {
              await supabase
                .from('hospital_users')
                .upsert({
                  user_id: workingRequest.user_id,
                  hospital_id: hospitalId,
                }, { onConflict: 'user_id' })
            } catch (e) {
              console.warn('Failed to automatically assign hospital', e)
            }
          }
        }

        if (isErTeamRequest) {
          const teamId = workingRequest.er_team_id || erTeamAssignments[workingRequest.user_id] || null
          if (teamId) {
            try {
              await supabase
                .from('er_team_users')
                .upsert({
                  user_id: workingRequest.user_id,
                  er_team_id: teamId,
                }, { onConflict: 'user_id' })
            } catch (e) {
              console.warn('Failed to automatically assign ER team', e)
            }
          }
        }

        // Create notification for the user
        try {
          await supabase.from('user_notifications').insert({
            user_id: workingRequest.user_id,
            emergency_report_id: null,
            message: `Your ${workingRequest.requested_role} account request has been approved! You can now log in with your new role.`,
          })
        } catch (e) {
          console.warn('Failed to create approval notification', e)
        }
      } else {
        // If rejecting, set status back to active user
        const { error: userUpdateError } = await supabase
          .from('users')
          .update({
            status: 'active',
            user_type: 'user'
          })
          .eq('id', workingRequest.user_id)

        if (userUpdateError) throw userUpdateError

        // Create notification for the user
        try {
          await supabase.from('user_notifications').insert({
            user_id: workingRequest.user_id,
            emergency_report_id: null,
            message: `Your ${workingRequest.requested_role} account request has been rejected. Reason: ${notes || 'No reason provided.'}`,
          })
        } catch (e) {
          console.warn('Failed to create rejection notification', e)
        }
      }

      // Refresh data
      await Promise.all([fetchUsers(), fetchApprovalRequests(), fetchHospitalsAndAssignments(), fetchErTeamsAndAssignments()])

    } catch (err) {
      console.error("Error handling approval action:", err)
      setError(`Failed to ${action} request. Please try again.`)
    }
  }

  // Set up real-time subscription for user updates
  const fetchErTeamsAndAssignments = async () => {
    try {
      const [teams, assignments] = await Promise.all([
        erTeamQueries.getErTeams(),
        erTeamQueries.getErTeamAssignments(),
      ])

      setErTeams(teams)
      const assignmentMap: Record<string, number | null> = {}
      assignments.forEach((item) => {
        assignmentMap[item.user_id] = item.er_team_id
      })
      setErTeamAssignments(assignmentMap)
    } catch (err) {
      console.error("Error fetching ER teams/assignments:", err)
    }
  }

  useEffect(() => {
    fetchUsers();
    fetchHospitalsAndAssignments();
    fetchErTeamsAndAssignments();
    fetchApprovalRequests();
    
    // Subscribe to user updates (still useful for role changes or external ban updates)
    const userSubscription = supabase
      .channel('user_changes')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'users' 
        }, 
        (payload: { new: User & { banned_until?: string | null; ban_reason?: string | null } }) => {
          // Update the user in the local state if they exist
          setUsers(currentUsers => 
            currentUsers.map(user => 
              user.id === payload.new.id 
                ? { 
                    ...user, 
                    ...payload.new,
                  } 
                : user
            )
          );
        }
      )
      .subscribe()

    // Cleanup subscription on component unmount
    return () => {
      supabase.removeChannel(userSubscription);
    };
  }, [])

  useEffect(() => {
    const loadCurrentUser = async () => {
      const { data: authData } = await supabase.auth.getUser()
      const authUser = authData?.user
      if (authUser?.id) {
        setCurrentUserId(authUser.id)
        const metadataName = typeof authUser.user_metadata?.full_name === 'string'
          ? authUser.user_metadata.full_name.trim()
          : ''
        if (metadataName) {
          setCurrentUserName(metadataName)
        }
      }
    }

    void loadCurrentUser()
  }, [])

  useEffect(() => {
    if (!currentUserId) return
    const matchedUser = users.find((user) => user.id === currentUserId)
    if (!matchedUser) return
    const nameParts = [matchedUser.firstName, matchedUser.middleName, matchedUser.lastName]
      .filter((part) => !!part && String(part).trim().length > 0)
      .map((part) => String(part).trim())
    const formattedName = nameParts.join(' ').trim()
    if (formattedName && formattedName !== currentUserName) {
      setCurrentUserName(formattedName)
    }
  }, [currentUserId, users, currentUserName])

  useEffect(() => {
    const name = currentUserName?.trim() || "Superadmin"
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    const hourFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      hour: 'numeric',
      hour12: false,
    })
    const updateGreetingAndTime = () => {
      const now = new Date()
      const hourPart = hourFormatter.formatToParts(now).find((part) => part.type === 'hour')
      const hour = hourPart ? Number.parseInt(hourPart.value, 10) : NaN
      let salutation = 'Good evening'
      if (Number.isFinite(hour)) {
        if (hour < 12) {
          salutation = 'Good morning'
        } else if (hour < 18) {
          salutation = 'Good afternoon'
        }
      }
      setGreetingMessage(`${salutation}, ${name}`)
      setCurrentDateTime(timeFormatter.format(now))
    }

    updateGreetingAndTime()
    const intervalId = window.setInterval(updateGreetingAndTime, 60_000)
    return () => window.clearInterval(intervalId)
  }, [currentUserName])

  // Update user role
  const handleRoleChange = async (userId: string, newRole: User['user_type']) => {
    try {
      setUsers(users.map(user => 
        user.id === userId ? { ...user, isUpdating: true } : user
      ))

      await userQueries.updateUserRole(userId, newRole as User['user_type'])

      if (newRole !== 'hospital') {
        await hospitalQueries.assignHospitalToUser(userId, null)
        setHospitalAssignments((prev) => ({
          ...prev,
          [userId]: null,
        }))
      }

      if (newRole !== 'er_team') {
        await erTeamQueries.assignErTeamToUser(userId, null)
        setErTeamAssignments((prev) => ({
          ...prev,
          [userId]: null,
        }))
      }

      setUsers(users.map(user => 
        user.id === userId 
          ? { ...user, user_type: newRole as User['user_type'], isUpdating: false } 
          : user
      ))
    } catch (err) {
      console.error("Error updating user role:", err)
      setError("Failed to update user role. Please try again.")
      setUsers(users.map(user => 
        user.id === userId 
          ? { ...user, isUpdating: false } 
          : user
      ))
    }
  }

  const handleHospitalAssignment = async (userId: string, hospitalId: string | null) => {
    setUsers(users.map((user) => (user.id === userId ? { ...user, isUpdating: true } : user)))
    try {
      await hospitalQueries.assignHospitalToUser(userId, hospitalId)
      setHospitalAssignments((prev) => ({
        ...prev,
        [userId]: hospitalId,
      }))
    } catch (err) {
      console.error("Error assigning hospital:", err)
      setError("Failed to update hospital assignment. Please try again.")
    } finally {
      setUsers(users.map((user) => (user.id === userId ? { ...user, isUpdating: false } : user)))
    }
  }

  const handleErTeamAssignment = async (userId: string, erTeamId: number | null) => {
    setUsers(users.map((user) => (user.id === userId ? { ...user, isUpdating: true } : user)))
    try {
      await erTeamQueries.assignErTeamToUser(userId, erTeamId)
      setErTeamAssignments((prev) => ({
        ...prev,
        [userId]: erTeamId,
      }))
    } catch (err) {
      console.error("Error assigning ER team:", err)
      setError("Failed to update ER team assignment. Please try again.")
    } finally {
      setUsers(users.map((user) => (user.id === userId ? { ...user, isUpdating: false } : user)))
    }
  }

  // Ban helpers
  const openBanDialog = (user: UserWithDisplayInfo) => {
    setBanTarget(user)
    setBanType('temporary')
    setBanDays('7')
    setBanReason('')
    setBanError(null)
    setShowBanModal(true)
  }

  const handleSubmitBan = async () => {
    if (!banTarget) return
    setIsSubmittingBan(true)
    setBanError(null)
    try {
      let bannedUntil: string | null = null
      if (banType === 'temporary') {
        const daysNum = parseInt(banDays || '0', 10)
        if (!Number.isFinite(daysNum) || daysNum <= 0) {
          setBanError('Please enter a valid number of days (> 0).')
          setIsSubmittingBan(false)
          return
        }
        bannedUntil = new Date(Date.now() + daysNum * 24 * 60 * 60 * 1000).toISOString()
      }

      await userQueries.updateUserBanStatus(banTarget.id, true, (banReason?.trim() || undefined), (bannedUntil ?? undefined))

      // In-app notification to the user (best-effort)
      try {
        await supabase.from('user_notifications').insert({
          user_id: banTarget.id,
          emergency_report_id: null,
          message: banType === 'permanent'
            ? `Your account has been permanently banned. Reason: ${banReason || 'No reason provided.'}`
            : `Your account has been banned for ${banDays} day(s). Reason: ${banReason || 'No reason provided.'}`,
        })
      } catch {}

      // Email notification (best-effort)
      try {
        await fetch('/api/send-ban-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: banTarget.email,
            name: `${banTarget.firstName} ${banTarget.lastName}`.trim(),
            reason: banReason || 'No reason provided.',
            until: bannedUntil,
            permanent: banType === 'permanent',
          }),
        })
      } catch {}

      setShowBanModal(false)
      setBanTarget(null)
    } catch (e: any) {
      setBanError(e?.message || 'Failed to ban user.')
    } finally {
      setIsSubmittingBan(false)
    }
  }

  const openUnbanDialog = (user: UserWithDisplayInfo) => {
    setUnbanTarget(user)
    setUnbanReason('')
    setUnbanError(null)
    setShowUnbanModal(true)
  }

  const handleUnban = async () => {
    if (!unbanTarget) return

    setIsSubmittingUnban(true)
    setUnbanError(null)
    try {
      // 1. Lift the ban
      await userQueries.updateUserBanStatus(unbanTarget.id, false, undefined, undefined)

      // 2. Notify the user via in-app notification
      try {
        await supabase.from('user_notifications').insert({
          user_id: unbanTarget.id,
          emergency_report_id: null,
          message: `Your account ban has been lifted. Message from admin: ${unbanReason || 'You may now use the app again.'}`,
        })
      } catch (e) { console.warn('In-app unban notification failed', e) }

      // 3. Notify the user via email
      try {
        await fetch('/api/send-unban-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: unbanTarget.email,
            name: `${unbanTarget.firstName} ${unbanTarget.lastName}`.trim(),
            reason: unbanReason || 'Your account access has been restored.',
          }),
        })
      } catch (e) { console.warn('Unban email failed to send', e) }

      // 4. Create an admin notification to trigger the overlay
      try {
        await supabase.from('admin_notifications').insert({
          type: 'user_unbanned',
          message: `User ${unbanTarget.firstName} ${unbanTarget.lastName} has been unbanned.`,
        })
      } catch (e) { console.warn('Admin unban overlay notification failed', e) }

      setShowUnbanModal(false)
      setUnbanTarget(null)
    } catch (e: any) {
      setUnbanError(e?.message || 'Failed to unban user.')
    } finally {
      setIsSubmittingUnban(false)
    }
  }

  const filteredUsers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch = search.length === 0 || [
        `${user.firstName} ${user.middleName ? `${user.middleName} ` : ''}${user.lastName}`.toLowerCase(),
        user.email.toLowerCase(),
        user.mobileNumber?.toLowerCase() || ''
      ].some(value => value.includes(search));

      const matchesRole = roleFilter === 'all' || user.user_type === roleFilter;
      const matchesStatus = statusFilter === 'all'
        ? true
        : statusFilter === 'banned'
          ? !!user.is_banned
          : !user.is_banned;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const sortedUsers = useMemo(() => {
    const roleOrder: Record<string, number> = { superadmin: 0, admin: 1, hospital: 2, responder: 3, user: 4 };
    return [...filteredUsers].sort((a, b) => {
      const roleA = roleOrder[a.user_type] ?? Number.MAX_SAFE_INTEGER;
      const roleB = roleOrder[b.user_type] ?? Number.MAX_SAFE_INTEGER;
      if (roleA !== roleB) return roleA - roleB;

      const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
      const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [filteredUsers]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter, statusFilter]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(sortedUsers.length / PAGE_SIZE)), [sortedUsers.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedUsers.slice(start, start + PAGE_SIZE);
  }, [sortedUsers, currentPage]);

  const showingRange = useMemo(() => {
    const total = sortedUsers.length;
    if (total === 0) return { from: 0, to: 0, total };
    const from = (currentPage - 1) * PAGE_SIZE + 1;
    const to = Math.min(total, currentPage * PAGE_SIZE);
    return { from, to, total };
  }, [sortedUsers.length, currentPage]);

  const goToPage = (page: number) => {
    setCurrentPage(prev => {
      const target = Math.min(Math.max(page, 1), totalPages);
      return target === prev ? prev : target;
    });
  };

  // Removed toggleBanUser, handleBanDateChange, handleBanReasonChange as they are no longer needed.

  const openApprovalDialog = (request: ApprovalRequest, action: 'approve' | 'reject') => {
    setApprovalTarget(request)
    setApprovalAction(action)
    setApprovalNotes('')
    setShowApprovalDialog(true)
  }

  const handleSubmitApproval = async () => {
    if (!approvalTarget) return

    setIsSubmittingApproval(true)
    try {
      await handleApprovalAction(approvalTarget.id, approvalAction, approvalNotes.trim() || undefined)
      setShowApprovalDialog(false)
      setApprovalTarget(null)
    } catch (err) {
      // Error is handled in handleApprovalAction
    } finally {
      setIsSubmittingApproval(false)
    }
  }

  const filteredApprovalRequests = useMemo(() => {
    if (approvalFilter === 'all') return approvalRequests
    return approvalRequests.filter(request => request.status === approvalFilter)
  }, [approvalRequests, approvalFilter])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }
  
  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/images/mdrrmo_dashboard_bg.jpg')" }}
    >
      <header className="fixed top-0 left-0 right-0 bg-orange-500 shadow z-50">
        <div className="w-full px-4 py-4 sm:px-6 lg:px-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/images/logo.png"
              alt="MDRRMO Logo"
              width={64}
              height={64}
              className="h-12 w-12 object-contain"
              priority
            />
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold text-white text-center">Superadmin Dashboard</h1>
              {greetingMessage ? (
                <p className="text-sm font-medium text-white leading-tight">{greetingMessage}</p>
              ) : null}
            </div>
          </div>
          <div className="flex justify-center lg:flex-1">
            {currentDateTime ? (
              <p className="text-2xl font-bold text-white text-center animate-pulse drop-shadow-md sm:text-3xl">
                {currentDateTime}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
            <Image
              src="/images/bulan-logo.png"
              alt="Bulan Municipality Logo"
              width={64}
              height={64}
              className="h-12 w-12 object-contain"
              priority
            />
          </div>
        </div>
      </header>

      <main className="pt-32 pb-6 px-4 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <CardTitle>User Management</CardTitle>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, email, or contact"
                  className="sm:w-64"
                />
                <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
                  <SelectTrigger className="sm:w-48">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="superadmin">Superadmin</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="hospital">Hospital</SelectItem>
                    <SelectItem value="er_team">ER Team</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                  <SelectTrigger className="sm:w-44">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="banned">Banned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Hospital / ER Team</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-sm text-gray-500">
                      No users match the current filters.
                    </TableCell>
                  </TableRow>
                ) : paginatedUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.firstName} {user.middleName ? `${user.middleName} ` : ''}{user.lastName}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.mobileNumber || 'N/A'}</TableCell>
                    <TableCell>
                      <Select
                        value={user.user_type}
                        onValueChange={(value) => {
                          // Prevent changing the role of superadmin users
                          if (user.user_type === 'superadmin') return;
                          handleRoleChange(user.id, value as User['user_type']);
                        }}
                        disabled={user.isUpdating || user.user_type === 'superadmin'}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="superadmin">Superadmin</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="hospital">Hospital</SelectItem>
                          <SelectItem value="er_team">ER Team</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {user.user_type === 'hospital' ? (
                        <Select
                          value={(hospitalAssignments[user.id] ?? null) ?? 'unassigned'}
                          onValueChange={(value) => {
                            const hospitalId = value === 'unassigned' ? null : value
                            void handleHospitalAssignment(user.id, hospitalId)
                          }}
                          disabled={user.isUpdating || hospitals.length === 0}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Assign hospital" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {hospitals.map((hospital) => (
                              <SelectItem key={hospital.id} value={hospital.id}>
                                {hospital.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : user.user_type === 'er_team' ? (
                        <Select
                          value={String((erTeamAssignments[user.id] ?? null) ?? 'unassigned')}
                          onValueChange={(value) => {
                            const nextValue = value === 'unassigned' ? null : Number(value)
                            void handleErTeamAssignment(user.id, nextValue)
                          }}
                          disabled={user.isUpdating || erTeams.length === 0}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Assign ER team" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {erTeams.map((team) => (
                              <SelectItem key={team.id} value={String(team.id)}>
                                {team.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-sm text-gray-500">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                              user.user_type === 'superadmin' 
                                ? 'bg-blue-100 text-blue-800' 
                                : user.is_banned 
                                  ? 'bg-red-100 text-red-800' 
                                  : 'bg-green-100 text-green-800'
                            )}>
                              {user.user_type === 'superadmin' ? 'Superadmin' : user.is_banned ? 'Banned' : 'Active'}
                              {(user.user_type === 'superadmin' || user.is_banned) && (
                                <Info className="ml-1 h-3 w-3" />
                              )}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            {user.user_type === 'superadmin' ? (
                              <p>Superadmin accounts cannot be modified</p>
                            ) : user.is_banned ? (
                              <div className="space-y-1">
                                <p><strong>Reason:</strong> {user.ban_reason || 'No reason provided'}</p>
                                {user.banned_until && (
                                  <p><strong>Until:</strong> {new Date(user.banned_until).toLocaleString()}</p>
                                )}
                              </div>
                            ) : (
                              <p>User is active</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {user.user_type !== 'superadmin' && (
                          user.is_banned ? (
                            <Button variant="outline" size="sm" onClick={() => openUnbanDialog(user)}>Unban</Button>
                          ) : (
                            <Button variant="destructive" size="sm" onClick={() => openBanDialog(user)}>Ban</Button>
                          )
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-gray-600">
                {showingRange.total === 0
                  ? 'No results found.'
                  : `Showing ${showingRange.from}-${showingRange.to} of ${showingRange.total} users`}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage <= 1 || showingRange.total === 0}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  Page {showingRange.total === 0 ? 0 : currentPage} of {showingRange.total === 0 ? 0 : totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage >= totalPages || showingRange.total === 0}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Approval Requests Section */}
      <main className="py-6 px-4 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <CardTitle>Account Approval Requests</CardTitle>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Select value={approvalFilter} onValueChange={(v) => setApprovalFilter(v as typeof approvalFilter)}>
                  <SelectTrigger className="sm:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Requests</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingApprovals ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : filteredApprovalRequests.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                No {approvalFilter === 'all' ? '' : approvalFilter} approval requests found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Requested Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApprovalRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {request.user?.firstName} {request.user?.lastName}
                          </div>
                          <div className="text-sm text-gray-500">{request.user?.email}</div>
                          {request.hospital_id && (
                            <div className="text-xs text-blue-600 mt-1">
                              Hospital: {hospitals.find(h => h.id === request.hospital_id)?.name || 'Unknown'}
                            </div>
                          )}
                          {request.er_team_id && (
                            <div className="text-xs text-green-600 mt-1">
                              ER Team: {request.er_team?.name || 'Unknown'}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                          request.requested_role === 'admin' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        )}>
                          {request.requested_role === 'admin' ? 'Admin Account' : 'Hospital Account'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {request.status === 'pending' && <Clock className="h-4 w-4 text-yellow-500" />}
                          {request.status === 'approved' && <CheckCircle className="h-4 w-4 text-green-500" />}
                          {request.status === 'rejected' && <XCircle className="h-4 w-4 text-red-500" />}
                          <span className={cn(
                            "text-sm font-medium",
                            request.status === 'pending' ? 'text-yellow-700' :
                            request.status === 'approved' ? 'text-green-700' : 'text-red-700'
                          )}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(request.requested_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {request.status === 'pending' && (
                            <>
                              <Button 
                                size="sm" 
                                onClick={() => openApprovalDialog(request, 'approve')}
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                Approve
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive" 
                                onClick={() => openApprovalDialog(request, 'reject')}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {request.status !== 'pending' && (
                            <span className="text-sm text-gray-500">
                              {request.reviewed_at ? `Reviewed ${new Date(request.reviewed_at).toLocaleDateString()}` : 'Reviewed'}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Ban Dialog */}
      <Dialog open={showBanModal} onOpenChange={setShowBanModal}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Ban User</DialogTitle>
            <DialogDescription>
              Choose ban type and provide a reason. The user will be notified and blocked from using the app.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-gray-700">
              User: {banTarget ? `${banTarget.firstName} ${banTarget.lastName} (${banTarget.email})` : ''}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Ban Type</label>
                <Select value={banType} onValueChange={(v) => setBanType(v as 'temporary' | 'permanent')}>
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="temporary">Temporary</SelectItem>
                    <SelectItem value="permanent">Permanent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {banType === 'temporary' && (
                <div>
                  <label className="text-sm font-medium">Days</label>
                  <Input type="number" min={1} value={banDays} onChange={(e) => setBanDays(e.target.value)} className="mt-1" />
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Reason</label>
              <Textarea rows={3} value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Describe the reason for banning..." className="mt-1" />
            </div>
            {banError && <div className="text-sm text-red-600">{banError}</div>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowBanModal(false)} disabled={isSubmittingBan}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleSubmitBan} disabled={isSubmittingBan || !banReason.trim()}>
                {isSubmittingBan ? 'Banning...' : 'Ban User'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unban Dialog */}
      <Dialog open={showUnbanModal} onOpenChange={setShowUnbanModal}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Unban User</DialogTitle>
            <DialogDescription>
              Provide a brief message for the user regarding the unban. This will be sent via email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-gray-700">
              User: {unbanTarget ? `${unbanTarget.firstName} ${unbanTarget.lastName} (${unbanTarget.email})` : ''}
            </div>
            <div>
              <label className="text-sm font-medium">Message / Reason for Unbanning</label>
              <Textarea 
                rows={4} 
                value={unbanReason} 
                onChange={(e) => setUnbanReason(e.target.value)} 
                placeholder="Example: Your access has been restored after a review. Please adhere to the community guidelines."
                className="mt-1"
              />
            </div>
            {unbanError && <div className="text-sm text-red-600">{unbanError}</div>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowUnbanModal(false)} disabled={isSubmittingUnban}>Cancel</Button>
              <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleUnban} disabled={isSubmittingUnban || !unbanReason.trim()}>
                {isSubmittingUnban ? 'Unbanning...' : 'Confirm Unban'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Approval Action Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {approvalAction === 'approve' ? 'Approve' : 'Reject'} Account Request
            </DialogTitle>
            <DialogDescription>
              {approvalAction === 'approve' 
                ? 'Confirm that you want to approve this account request.' 
                : 'Provide a reason for rejecting this account request.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-gray-700">
              User: {approvalTarget ? `${approvalTarget.user?.firstName} ${approvalTarget.user?.lastName} (${approvalTarget.user?.email})` : ''}
            </div>
            <div className="text-sm text-gray-700">
              Requested Role: <span className="font-medium capitalize">{approvalTarget?.requested_role} Account</span>
            </div>
            {approvalAction === 'reject' && (
              <div>
                <label className="text-sm font-medium">Reason for Rejection</label>
                <Textarea 
                  rows={3} 
                  value={approvalNotes} 
                  onChange={(e) => setApprovalNotes(e.target.value)} 
                  placeholder="Please provide a reason for rejecting this request..."
                  className="mt-1"
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowApprovalDialog(false)} disabled={isSubmittingApproval}>
                Cancel
              </Button>
              <Button 
                className={approvalAction === 'approve' ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
                onClick={handleSubmitApproval} 
                disabled={isSubmittingApproval || (approvalAction === 'reject' && !approvalNotes.trim())}
              >
                {isSubmittingApproval 
                  ? (approvalAction === 'approve' ? 'Approving...' : 'Rejecting...') 
                  : (approvalAction === 'approve' ? 'Approve' : 'Reject')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent className="w-80">
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>
              Are you sure you want to log out of the superadmin dashboard?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setShowLogoutConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              Confirm Logout
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

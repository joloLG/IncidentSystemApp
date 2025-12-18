"use client"

  import React, { useState, useEffect, useCallback, useRef, useMemo, useDeferredValue } from "react"
import { Capacitor } from "@capacitor/core"
import type { PluginListenerHandle } from "@capacitor/core"
import { App } from "@capacitor/app"
  import { Button } from "@/components/ui/button"
import { AlertTriangle, Menu, User, LogOut, Bell, History, Info, Phone, Edit, Mail, X, Send, FireExtinguisher, HeartPulse, Car, CloudRain, LandPlot, HelpCircle, Swords, PersonStanding, MapPin, RefreshCcw, Megaphone, Star, Loader2, Wand2, Search } from "lucide-react" // Added Swords for Armed Conflict
  import { UserSidebar } from "./user_sidebar"
  import { LocationPermissionModal } from "./location-permission-modal"
  import { supabase } from "@/lib/supabase"
  import type { RealtimeChannel } from "@supabase/supabase-js"
  import { Input } from "@/components/ui/input"
  import { Textarea } from "@/components/ui/textarea"
  import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
  import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
  import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
  import { formatDistanceToNowStrict, parseISO, formatDistanceToNow } from 'date-fns';
  import { FeedbackHistory } from "@/components/feedback-history"
import { ReportDetailModal } from "@/components/ReportDetailModal"
import { useAppStore } from '@/lib/store'
  import type { AppState } from '@/lib/store'
  import { initMobileState, destroyMobileState, notifications$, userReports$ as mobileUserReports$, type MobileNotification, type MobileReport } from '@/lib/mobileState'
import { useRouter } from 'next/navigation'
import { usePushNotifications } from '@/components/providers/PushNotificationsProvider'
import { useLocationPermission } from '@/lib/hooks/useLocationPermission'


interface Notification {
  id: string;
  emergency_report_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface Report {
  id: string;
  user_id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  mobileNumber: string;
  latitude: number;
  longitude: number;
  location_address: string;
  emergency_type: string;
  status: string;
  admin_response?: string;
  created_at: string;
  responded_at?: string;
  resolved_at?: string;
  reportedAt: string;
  reporterMobile?: string;
  casualties?: number;
}

interface Hotline {
  id: string;
  name: string;
  number: string;
  description?: string;
}

interface MdrrmoInfo {
  id: string;
  content: string;
}

interface Advisory {
  id: string;
  preset: string | null;
  title: string | null;
  body: string | null;
  expires_at: string | null;
  created_at: string | null;
  created_by: string | null;
}

interface QueuedReport {
  id: string;
  createdAt: string;
  emergencyType: string;
  location: string;
  queueTimestamp: number;
}

const PROFILE_CACHE_KEY = "mdrrmo_user_profile_cache"

interface ProfileCacheRecord {
  user: any
  cachedAt: string
}

const readCachedProfile = (): ProfileCacheRecord | null => {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(PROFILE_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ProfileCacheRecord
    if (!parsed || typeof parsed !== "object" || !parsed.user) return null
    return parsed
  } catch (error) {
    console.warn("Failed to read cached user profile", error)
    return null
  }
}

const writeCachedProfile = (user: any) => {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
      user,
      cachedAt: new Date().toISOString()
    }))
  } catch (error) {
    console.warn("Failed to cache user profile", error)
  }
}

interface DashboardProps {
  onLogout: () => void
  userData?: any
}

interface PublishedNarrative {
  id: string
  title: string
  narrative_text: string
  image_url: string | null
  internal_report_id: number | null
  published_at: string | null
  created_at: string
}

const INCIDENT_TYPES = [
  { type: 'Fire Incident', icon: FireExtinguisher }, 
  { type: 'Medical Emergency', icon: HeartPulse },
  { type: 'Vehicular Incident', icon: Car }, 
  { type: 'Weather Disturbance', icon: CloudRain }, 
  { type: 'Public Disturbance', icon: PersonStanding }, 
  { type: 'Others', icon: (props: any) => <HelpCircle className="text-orange-500" {...props} /> },
];

const formatMobileNumberForInput = (value: string | null | undefined) => {
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length >= 12) {
    return `0${digits.slice(2, 12)}`;
  }
  if (digits.startsWith("0") && digits.length >= 11) {
    return digits.slice(0, 11);
  }
  if (digits.startsWith("9") && digits.length >= 10) {
    return `0${digits.slice(0, 10)}`;
  }
  return digits.slice(0, 11);
};

export function Dashboard({ onLogout, userData }: DashboardProps) {
  const router = useRouter();
  const { playAlertSound, showBroadcastAlert } = usePushNotifications();
  const [isEmergencyActive, setIsEmergencyActive] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const [isDesktop, setIsDesktop] = useState(false)
  const [isTabletOrDesktop, setIsTabletOrDesktop] = useState(false)
  const [isSidebarVisible, setIsSidebarVisible] = useState(false)
  
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth
      setIsDesktop(width >= 1024)
      setIsTabletOrDesktop(width >= 768) 
    }
    
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  const effectiveSidebarOpen = isDesktop || isSidebarOpen
  const [showSOSConfirm, setShowSOSConfirm] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  const {
    location,
    locationError,
    showLocationModal,
    setShowLocationModal,
    ensureLocationReady,
    requestPermission: requestLocationPermission,
    getFreshLocation,
  } = useLocationPermission({ userId: currentUser?.id });

  const isNativePlatform = useMemo(() => Capacitor.isNativePlatform(), []);

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [currentView, setCurrentView] = useState<'main' | 'reportHistory' | 'mdrrmoInfo' | 'incidentPosts' | 'userProfile' | 'sendFeedback'>('main');
  const [hasLoadedUserData, setHasLoadedUserData] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [reportPage, setReportPage] = useState<number>(1);
  const PAGE_SIZE = 10;
  const MIN_HIDDEN_MS_BEFORE_REFRESH = 5000; 

  const INCIDENT_PAGE_SIZE = 10
  const [incidentPosts, setIncidentPosts] = useState<PublishedNarrative[]>([])
  const [incidentPostsTotal, setIncidentPostsTotal] = useState(0)
  const [incidentPostsPage, setIncidentPostsPage] = useState(1)
  const [incidentPostsSearch, setIncidentPostsSearch] = useState("")
  const deferredIncidentSearch = useDeferredValue(incidentPostsSearch)
  const [incidentPostsLoading, setIncidentPostsLoading] = useState(false)
  const [incidentPostsError, setIncidentPostsError] = useState<string | null>(null)
  const incidentPostsTotalPages = useMemo(() => Math.max(1, Math.ceil(incidentPostsTotal / INCIDENT_PAGE_SIZE)), [incidentPostsTotal])

  const [deepLinkedReport, setDeepLinkedReport] = useState<Report | null>(null);
  const [isReportDetailModalOpen, setIsReportDetailModalOpen] = useState(false);

  const setStoreCurrentUser = useAppStore((s: AppState) => s.setCurrentUser)
  const isOnline = useAppStore((s: AppState) => s.isOnline)
  const connectionType = useAppStore((s: AppState) => s.connectionType)

  const notificationsRef = useRef<HTMLDivElement>(null);
  const notificationsButtonRef = useRef<HTMLButtonElement>(null);
  const isResumingRef = useRef<boolean>(false);
  const lastResumeAtRef = useRef<number>(0);
  const RESUME_COOLDOWN_MS = 1000; 
  const lastHiddenAtRef = useRef<number | null>(null);

  const [editingMobileNumber, setEditingMobileNumber] = useState<string>('');
  const [editingUsername, setEditingUsername] = useState<string>('');
  const [profileEditSuccess, setProfileEditSuccess] = useState<string | null>(null);
  const [profileEditError, setProfileEditError] = useState<string | null>(null);
  const [mobileNumberError, setMobileNumberError] = useState<string | null>(null);
  const [profileOtpMessageId, setProfileOtpMessageId] = useState<string | null>(null);
  const [profileOtpCode, setProfileOtpCode] = useState<string>('');
  const [profileOtpError, setProfileOtpError] = useState<string | null>(null);
  const [profileOtpSuccess, setProfileOtpSuccess] = useState<string | null>(null);
  const [isProfileOtpSending, setIsProfileOtpSending] = useState<boolean>(false);
  const [isProfileOtpVerifying, setIsProfileOtpVerifying] = useState<boolean>(false);
  const [isProfileOtpVerified, setIsProfileOtpVerified] = useState<boolean>(false);
  const [profileOtpResendTimer, setProfileOtpResendTimer] = useState<number>(0);

  const resetProfileOtpProgress = (verified: boolean) => {
    setIsProfileOtpVerified(verified);
    setProfileOtpMessageId(null);
    setProfileOtpCode('');
    setProfileOtpError(null);
    setProfileOtpSuccess(null);
    setProfileOtpResendTimer(0);
    setIsProfileOtpSending(false);
    setIsProfileOtpVerifying(false);
  };

  const formattedCurrentMobile = useMemo(() => {
    if (!currentUser?.mobileNumber) return '';
    const raw = String(currentUser.mobileNumber).replace(/\D/g, '');
    if (raw.startsWith('63') && raw.length === 12) {
      return `0${raw.slice(2)}`;
    }
    if (raw.startsWith('0') && raw.length === 11) {
      return raw;
    }
    if (raw.startsWith('9') && raw.length === 10) {
      return `0${raw}`;
    }
    return raw;
  }, [currentUser?.mobileNumber]);

  const mobileNumberHasChanged = useMemo(() => {
    if (!formattedCurrentMobile) {
      return editingMobileNumber.length > 0;
    }
    return editingMobileNumber !== formattedCurrentMobile;
  }, [formattedCurrentMobile, editingMobileNumber]);

  const profileMobileDisplay = useMemo(() => formattedCurrentMobile, [formattedCurrentMobile]);

  useEffect(() => {
    if (profileOtpResendTimer <= 0) return;
    const timer = setInterval(() => {
      setProfileOtpResendTimer(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [profileOtpResendTimer]);

  const isUserBanned = useMemo(() => {
    const u = currentUser;
    if (!u || !u.is_banned) return false;
    if (!u.banned_until) return true;
    const until = new Date(u.banned_until).getTime();
    return isFinite(until) && until > Date.now();
  }, [currentUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showNotifications && 
          notificationsRef.current && 
          !notificationsRef.current.contains(event.target as Node) &&
          notificationsButtonRef.current &&
          !notificationsButtonRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  const [feedbackText, setFeedbackText] = useState<string>('');
  const [feedbackSentMessage, setFeedbackSentMessage] = useState<string | null>(null);
  const [feedbackErrorMessage, setFeedbackErrorMessage] = useState<string | null>(null);
  const [feedbackCategory, setFeedbackCategory] = useState<'bug' | 'feature' | 'question' | 'other'>('bug');
  const [feedbackRating, setFeedbackRating] = useState<number>(0);
  const [isSendingFeedback, setIsSendingFeedback] = useState<boolean>(false);
  const FEEDBACK_MAX = 500;
  const FEEDBACK_MIN = 10;
  const feedbackCharsLeft = useMemo(() => FEEDBACK_MAX - feedbackText.length, [feedbackText]);
  const feedbackTooShort = useMemo(() => feedbackText.trim().length < FEEDBACK_MIN, [feedbackText]);

  const [userReports, setUserReports] = useState<Report[]>([]);
  const [mdrrmoInformation, setMdrrmoInformation] = useState<MdrrmoInfo | null>(null);
  const [bulanHotlines, setBulanHotlines] = useState<Hotline[]>([]);
  const [activeAdvisory, setActiveAdvisory] = useState<Advisory | null>(null);
  const [queuedReports, setQueuedReports] = useState<QueuedReport[]>([]);
  const queuedReportsKey = useMemo(() => currentUser?.id ? `mdrrmo_${currentUser.id}_queuedReports` : null, [currentUser?.id]);
  const flushNoticeKey = useMemo(() => currentUser?.id ? `mdrrmo_${currentUser.id}_queueFlushNotice` : null, [currentUser?.id]);
  const [showQueuedNotice, setShowQueuedNotice] = useState(false);

  const reportsSource = userReports;
  const reliableConnection = useMemo(() => true, [])

  const notificationsSource = notifications;
  const unreadNotificationsCount = useMemo(() => (notificationsSource || []).filter(n => !n.is_read).length, [notificationsSource]);
  const totalReportPages = useMemo(() => Math.max(1, Math.ceil((reportsSource?.length || 0) / PAGE_SIZE)), [reportsSource?.length]);
  const paginatedReports = useMemo(() => {
    const src = reportsSource || [];
    const start = (reportPage - 1) * PAGE_SIZE;
    return src.slice(start, start + PAGE_SIZE);
  }, [reportsSource, reportPage]);

  useEffect(() => {
    if (reportPage > totalReportPages) setReportPage(totalReportPages);
  }, [totalReportPages, reportPage]);

  const [selectedIncidentTypeForConfirmation, setSelectedIncidentTypeForConfirmation] = useState<string | null>(null);
  const [customEmergencyType, setCustomEmergencyType] = useState<string>('');
  const [showCustomEmergencyInput, setShowCustomEmergencyInput] = useState<boolean>(false);
  const [casualties, setCasualties] = useState<string>('');
  const [cooldownActive, setCooldownActive] = useState<boolean>(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0); 
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [reportCredits, setReportCredits] = useState<number>(3); 
  const [creditConsumptionTimes, setCreditConsumptionTimes] = useState<number[]>([]);
  const provisionalTimeRef = useRef<number | null>(null);
  
  const getCreditStorageKey = useCallback((suffix: string) => {
    return currentUser ? `mdrrmo_${currentUser.id}_${suffix}` : null;
  }, [currentUser?.id]);
  
  useEffect(() => {
    if (!currentUser?.id) return;
    
    const creditsKey = getCreditStorageKey('reportCredits');
    const timesKey = getCreditStorageKey('creditConsumptionTimes');
    
    if (creditsKey && timesKey) {
      const storedTimes = localStorage.getItem(timesKey);
      if (storedTimes) {
        try {
          const parsedTimes = JSON.parse(storedTimes);
          if (Array.isArray(parsedTimes)) {
            const now = Date.now();
            const tenMinutes = 10 * 60 * 1000;
            const validTimes = parsedTimes.filter((ts: number) => (now - ts) < tenMinutes);
            setCreditConsumptionTimes(validTimes);
            const used = validTimes.length;
            setReportCredits(Math.max(0, 3 - used));
          }
        } catch (e) {
          console.error('Error parsing stored credit times:', e);
          setCreditConsumptionTimes([]);
          setReportCredits(3);
        }
      } else {
        setCreditConsumptionTimes([]);
        setReportCredits(3);
      }
    }
  }, [currentUser?.id, getCreditStorageKey]);
  
  const [activeCooldowns, setActiveCooldowns] = useState<number[]>([]);

  const reconcileCooldownsAndCredits = useCallback(() => {
    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000;

    const validTimes = creditConsumptionTimes.filter(ts => (now - ts) < tenMinutes);
    if (validTimes.length !== creditConsumptionTimes.length) {
      setCreditConsumptionTimes(validTimes);
    }

    const newCooldowns = validTimes.map(ts => ts + tenMinutes);
    setActiveCooldowns(newCooldowns);

    const used = validTimes.length;
    const newCredits = Math.max(0, 3 - used);
    setReportCredits(newCredits);
    if (newCooldowns.length > 0) {
      const nextMs = Math.max(0, Math.min(...newCooldowns) - now);
      setCooldownRemaining(Math.ceil(nextMs / 1000));
      setCooldownActive(newCredits === 0);
    } else {
      setCooldownRemaining(0);
      setCooldownActive(false);
    }
  }, [creditConsumptionTimes]);

  const persistQueuedReports = useCallback((items: QueuedReport[]) => {
    if (!queuedReportsKey) return;
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(queuedReportsKey, JSON.stringify(items));
    } catch {}
  }, [queuedReportsKey]);

  const addQueuedReport = useCallback((report: QueuedReport) => {
    setShowQueuedNotice(false);
    setQueuedReports(prev => {
      const existing = prev.filter(item => item.id !== report.id);
      const next = [report, ...existing].sort((a, b) => {
        const tsDiff = (b.queueTimestamp ?? 0) - (a.queueTimestamp ?? 0);
        if (tsDiff !== 0) return tsDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      persistQueuedReports(next);
      return next;
    });
  }, [persistQueuedReports]);

  const removeQueuedReports = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setQueuedReports(prev => {
      const next = prev.filter(item => !ids.includes(item.id));
      persistQueuedReports(next);
      return next;
    });
  }, [persistQueuedReports]);

  const loadQueuedReports = useCallback(() => {
    if (!queuedReportsKey) {
      setQueuedReports([]);
      return;
    }
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(queuedReportsKey);
      if (!raw) {
        setQueuedReports([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const sanitized = parsed.map((item: any) => {
          const createdAt = typeof item?.createdAt === 'string' ? item.createdAt : new Date().toISOString();
          const queueTimestamp = typeof item?.queueTimestamp === 'number' && Number.isFinite(item.queueTimestamp)
            ? item.queueTimestamp
            : new Date(createdAt).getTime() || Date.now();
          return {
            id: String(item?.id ?? `queued-${queueTimestamp}`),
            createdAt,
            emergencyType: String(item?.emergencyType ?? 'Emergency'),
            location: String(item?.location ?? 'Unknown location'),
            queueTimestamp,
          } as QueuedReport;
        }).sort((a, b) => (b.queueTimestamp ?? 0) - (a.queueTimestamp ?? 0));
        setQueuedReports(sanitized);
      }
    } catch {
      setQueuedReports([]);
    }
  }, [queuedReportsKey]);

  const finalizeQueuedReports = useCallback((entries: Array<{ queueId?: string | null; queueTimestamp?: number | null }>) => {
    if (!entries?.length) return;
    const idSet = new Set<string>();
    const tsSet = new Set<number>();
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const queueId = entry.queueId;
      const queueTimestamp = entry.queueTimestamp;
      if (queueId) idSet.add(String(queueId));
      if (typeof queueTimestamp === 'number' && Number.isFinite(queueTimestamp)) {
        tsSet.add(queueTimestamp);
      }
    }
    if (idSet.size === 0 && tsSet.size === 0) return;
    setQueuedReports(prev => {
      const next = prev.filter(item => !idSet.has(item.id) && !tsSet.has(item.queueTimestamp));
      persistQueuedReports(next);
      return next;
    });
    if (flushNoticeKey && typeof window !== 'undefined') {
      try { localStorage.setItem(flushNoticeKey, String(Date.now())); } catch {}
    }
    setShowQueuedNotice(true);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        setShowQueuedNotice(false);
      }, 5000);
    }
  }, [persistQueuedReports, flushNoticeKey]);

  const handleFlushQueued = useCallback(() => {
    if (typeof navigator === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then(registration => {
      registration.active?.postMessage({ type: 'FLUSH_QUEUE' });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadQueuedReports();
    if (!flushNoticeKey || typeof window === 'undefined') {
      return;
    }
    try {
      const lastSuccess = localStorage.getItem(flushNoticeKey);
      if (lastSuccess) {
        setShowQueuedNotice(true);
      }
    } catch {}
  }, [loadQueuedReports, flushNoticeKey]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'QUEUE_FLUSHED') {
        finalizeQueuedReports(Array.isArray(data.entries) ? data.entries : []);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handler);
    };
  }, [finalizeQueuedReports]);

  useEffect(() => {
    if (isOnline && queuedReports.length > 0) {
      handleFlushQueued();
    }
  }, [isOnline, queuedReports.length, handleFlushQueued]);

  useEffect(() => {
    if (activeCooldowns.length === 0) {
      setCooldownRemaining(0);
      setCooldownActive(false);
      return;
    }

    const tick = () => {
      const now = Date.now();
      const nextExpiry = Math.min(...activeCooldowns);
      const msRemaining = Math.max(0, nextExpiry - now);
      const secondsRemaining = Math.ceil(msRemaining / 1000);
      setCooldownRemaining(secondsRemaining > 0 ? secondsRemaining : 0);
      setCooldownActive(reportCredits === 0 && secondsRemaining > 0);
      if (msRemaining <= 0) {
        reconcileCooldownsAndCredits();
      }
    };

    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [activeCooldowns, reconcileCooldownsAndCredits, reportCredits]);

  useEffect(() => {
    if (currentView !== 'incidentPosts') return
    let isCancelled = false
    const fetchPosts = async () => {
      setIncidentPostsLoading(true)
      setIncidentPostsError(null)
      try {
        const from = (incidentPostsPage - 1) * INCIDENT_PAGE_SIZE
        const to = from + INCIDENT_PAGE_SIZE - 1
        let query = supabase
          .from('narrative_reports')
          .select('id, narrative_text, image_url, internal_report_id, published_at, created_at', { count: 'exact' })
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .range(from, to)

        if (deferredIncidentSearch.trim()) {
          const term = deferredIncidentSearch.trim()
          query = query.or(`title.ilike.%${term}%,narrative_text.ilike.%${term}%`)
        }

        const { data, error, count } = await query
        if (error) throw error
        if (!isCancelled) {
          setIncidentPosts((data as PublishedNarrative[]) ?? [])
          setIncidentPostsTotal(count ?? 0)
        }
      } catch (err: any) {
        if (!isCancelled) {
          setIncidentPostsError(err?.message ?? 'Failed to load incident posts')
        }
      } finally {
        if (!isCancelled) {
          setIncidentPostsLoading(false)
        }
      }
    }

    void fetchPosts()
    return () => {
      isCancelled = true
    }
  }, [currentView, incidentPostsPage, deferredIncidentSearch])

  useEffect(() => {
    if (currentView === 'incidentPosts') return
    setIncidentPostsPage(1)
    setIncidentPostsSearch("")
  }, [currentView])

  useEffect(() => {
    if (currentView !== 'incidentPosts') return
    setIncidentPostsPage(1)
  }, [deferredIncidentSearch, currentView])

  useEffect(() => {
    if (incidentPostsPage > incidentPostsTotalPages) {
      setIncidentPostsPage(incidentPostsTotalPages)
    }
  }, [incidentPostsPage, incidentPostsTotalPages])

  // Realtime channel refs
  const notificationsChannelRef = useRef<RealtimeChannel | null>(null);
  const userReportsChannelRef = useRef<RealtimeChannel | null>(null);
  const mdrrmoInfoChannelRef = useRef<RealtimeChannel | null>(null);
  const hotlinesChannelRef = useRef<RealtimeChannel | null>(null);
  const broadcastAlertsChannelRef = useRef<RealtimeChannel | null>(null);
  const advisoriesChannelRef = useRef<RealtimeChannel | null>(null);

  const cleanupRealtime = useCallback(() => {
    try {
      if (notificationsChannelRef.current) {
        supabase.removeChannel(notificationsChannelRef.current);
        notificationsChannelRef.current = null;
      }
      if (userReportsChannelRef.current) {
        supabase.removeChannel(userReportsChannelRef.current);
        userReportsChannelRef.current = null;
      }
      if (mdrrmoInfoChannelRef.current) {
        supabase.removeChannel(mdrrmoInfoChannelRef.current);
        mdrrmoInfoChannelRef.current = null;
      }
      if (hotlinesChannelRef.current) {
        supabase.removeChannel(hotlinesChannelRef.current);
        hotlinesChannelRef.current = null;
      }
      if (broadcastAlertsChannelRef.current) {
        supabase.removeChannel(broadcastAlertsChannelRef.current);
        broadcastAlertsChannelRef.current = null;
      }
      if (advisoriesChannelRef.current) {
        supabase.removeChannel(advisoriesChannelRef.current);
        advisoriesChannelRef.current = null;
      }
    } catch {}
  }, []);

  const loadNotifications = useCallback(async (userId: string) => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("user_notifications")
      .select("id, emergency_report_id, message, is_read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50); 

    if (!error && data) {
      setNotifications(data as Notification[]);
    } else if (error) {
      console.error("Error loading user notifications:", error);
    }
  }, []);

  const loadUserReports = useCallback(async (userId: string) => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('emergency_reports')
      .select('id, emergency_type, status, admin_response, resolved_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100); 

    if (!error && data) {
      setUserReports(data as Report[]);
    } else if (error) {
      console.error("Error loading user reports:", error);
    }
  }, []);

  const loadMdrrmoInfo = useCallback(async () => {
    const { data, error } = await supabase
      .from('mdrrmo_info')
      .select('id, content')
      .single(); 

    if (!error && data) {
      setMdrrmoInformation(data as MdrrmoInfo);
    } else if (error && error.code !== 'PGRST116') { 
      console.error("Error loading MDRRMO Information:", error);
    } else if (error && error.code === 'PGRST116') {
      console.log("No MDRRMO Information found. It might not be set by admin yet.");
      setMdrrmoInformation(null); 
    }
  }, []);

  const loadBulanHotlines = useCallback(async () => {
    const { data, error } = await supabase
      .from('hotlines')
      .select('id, name, number, description')
      .order('name', { ascending: true });

    if (!error && data) {
      setBulanHotlines(data as Hotline[]);
    } else if (error) {
      console.error("Error loading Bulan Hotlines:", error);
    }
  }, []);

  const loadActiveAdvisory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('advisories')
        .select('id, preset, title, body, expires_at, created_at, created_by')
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) {
        console.error('Error loading advisories:', error);
        setActiveAdvisory(null);
        return;
      }
      const row = (data || [])[0] as Advisory | undefined;
      setActiveAdvisory(row || null);
    } catch (e) {
      console.error('Error loading advisories:', e);
      setActiveAdvisory(null);
    }
  }, []);

    useEffect(() => {
    if (!activeAdvisory?.expires_at) return;
    const expiryMs = new Date(activeAdvisory.expires_at).getTime();
    const now = Date.now();
    if (!isFinite(expiryMs) || expiryMs <= now) return;
    const delay = Math.min(Math.max(0, expiryMs - now + 300), 24 * 60 * 60 * 1000); 
    const timer = setTimeout(() => { void loadActiveAdvisory(); }, delay);
    return () => clearTimeout(timer);
  }, [activeAdvisory?.expires_at, loadActiveAdvisory]);

  const setupRealtime = useCallback((userId: string) => {
    if (!userId) return;
    cleanupRealtime();

    notificationsChannelRef.current = supabase
      .channel(`user_notifications_channel_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          void loadNotifications(userId)
          try {
            if ((payload as any)?.eventType === 'INSERT') {
              void playAlertSound('notification')
            }
          } catch {}
        }
      )
      .subscribe();

    userReportsChannelRef.current = supabase
      .channel(`user_reports_channel_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'emergency_reports', filter: `user_id=eq.${userId}` },
        (payload) => {
          loadUserReports(userId);
          if (payload.eventType === 'INSERT' && payload.new.user_id === userId) {
            const serverCreatedAt = new Date(payload.new.created_at).getTime();
            setCreditConsumptionTimes(prev => {
              const newTimes = [...prev];
              if (provisionalTimeRef.current) {
                const index = newTimes.indexOf(provisionalTimeRef.current);
                if (index > -1) {
                  newTimes[index] = serverCreatedAt;
                } else {
                  newTimes.push(serverCreatedAt);
                }
                provisionalTimeRef.current = null;
              } else {
                newTimes.push(serverCreatedAt);
              }
              return newTimes.sort((a, b) => a - b);
            });
          }
        }
      )
      .subscribe();

    mdrrmoInfoChannelRef.current = supabase
      .channel('mdrrmo_info_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mdrrmo_info' },
        () => loadMdrrmoInfo()
      )
      .subscribe();

    hotlinesChannelRef.current = supabase
      .channel('hotlines_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hotlines' },
        () => loadBulanHotlines()
      )
      .subscribe();

    broadcastAlertsChannelRef.current = supabase
      .channel('broadcast_alerts_channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'broadcast_alerts' },
        (payload: any) => {
          try {
            console.log('[BroadcastAlert] incoming', payload?.new);
            const t = String(payload?.new?.type || '').toLowerCase();
            const title = payload?.new?.title || 'MDRRMO Alert';
            const body = payload?.new?.body || '';
            try { console.log('[Broadcast Alert]', title, body); } catch {}
            if (t === 'earthquake' || t === 'tsunami') {
              showBroadcastAlert({
                type: t as 'earthquake' | 'tsunami',
                title,
                body,
                createdAt: payload?.new?.created_at || null,
              });
              if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                try {
                  navigator.vibrate?.([400, 200, 400]);
                } catch {}
              }
              void playAlertSound(t as 'earthquake' | 'tsunami');
            }
          } catch {}
        }
      )
      .subscribe();

    advisoriesChannelRef.current = supabase
      .channel('advisories_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'advisories' },
        () => { void loadActiveAdvisory(); }
      )
      .subscribe();
  }, [cleanupRealtime, loadNotifications, loadUserReports, loadMdrrmoInfo, loadBulanHotlines, playAlertSound, showBroadcastAlert]);

  const refreshUserData = useCallback(async (userId: string) => {
    try {
      await Promise.all([
        loadNotifications(userId),
        loadUserReports(userId),
      ]);
    } catch (e) {
      console.warn('Partial failure while refreshing user lists:', e);
    }

    void loadMdrrmoInfo();
    void loadBulanHotlines();
    void loadActiveAdvisory();
  }, [loadNotifications, loadUserReports, loadMdrrmoInfo, loadBulanHotlines, loadActiveAdvisory]);
  const runRefresh = useCallback(async (showSpinner: boolean) => {
    const now = Date.now();
    if (now - lastResumeAtRef.current < RESUME_COOLDOWN_MS) return;
    lastResumeAtRef.current = now;

    if (isResumingRef.current) return;
    isResumingRef.current = true;

    const hideAt = Date.now() + 1000;
    if (showSpinner) setIsRefreshing(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (!uid) {
        onLogout();
        return;
      }
      await Promise.allSettled([
        loadNotifications(uid),
        loadUserReports(uid),
      ]);
      void loadMdrrmoInfo();
      void loadBulanHotlines();
      void loadActiveAdvisory();
    } catch (e) {
      console.warn('refresh error:', e);
    } finally {
      if (showSpinner) {
        const remaining = hideAt - Date.now();
        if (remaining > 0) {
          await new Promise(res => setTimeout(res, remaining));
        }
        setIsRefreshing(false);
      }
      isResumingRef.current = false;
    }
  }, [RESUME_COOLDOWN_MS, onLogout, loadNotifications, loadUserReports, loadMdrrmoInfo, loadBulanHotlines, loadActiveAdvisory, isNativePlatform]);

  const handleRequestLocation = useCallback(async () => {
    return requestLocationPermission();
  }, [requestLocationPermission]);

  const quickRefresh = useCallback(async () => {
    await runRefresh(true);
  }, [runRefresh]);

  const silentRefresh = useCallback(async () => {
    await runRefresh(false);
  }, [runRefresh]);

  const forceReinit = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user?.id) {
        onLogout();
        return;
      }
      const userId = sessionData.session.user.id;

      // Try to fetch profile
      let userProfile = null;
      const cache = readCachedProfile();

      try {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();
        userProfile = data;
        writeCachedProfile(data);
      } catch (error: any) {
        console.warn("Failed to fetch user profile in forceReinit:", error);
        if (cache && cache.user.id === userId) {
          console.log("Using cached user profile in forceReinit");
          userProfile = cache.user;
        } else {
          onLogout();
          return;
        }
      }

      if (!userProfile) {
        onLogout();
        return;
      }

      setCurrentUser(userProfile);
      setEditingMobileNumber(formatMobileNumberForInput(userProfile.mobileNumber));
      setEditingUsername(userProfile.username || '');

      await refreshUserData(userId);
      setupRealtime(userId);

      await ensureLocationReady();

      reconcileCooldownsAndCredits();
    } catch (e) {
      console.warn('forceReinit error:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, [onLogout, refreshUserData, setupRealtime, ensureLocationReady, reconcileCooldownsAndCredits]);

  useEffect(() => {
    const timesKey = getCreditStorageKey('creditConsumptionTimes');
    if (!timesKey) return;

    const updateFromStorage = () => {
      const storedTimes = localStorage.getItem(timesKey);
      let consumptionTimes: number[] = [];
      if (storedTimes) {
        try {
          const parsed = JSON.parse(storedTimes);
          if (Array.isArray(parsed)) {
            consumptionTimes = parsed;
          }
        } catch {}
      }

      const now = Date.now();
      const tenMinutes = 10 * 60 * 1000;
      const validTimes = consumptionTimes.filter(ts => (now - ts) < tenMinutes);

      if (validTimes.length !== consumptionTimes.length) {
        localStorage.setItem(timesKey, JSON.stringify(validTimes));
      }
      setCreditConsumptionTimes(prev => {
        if (prev.length === validTimes.length && prev.every((v, i) => v === validTimes[i])) return prev;
        return validTimes;
      });

      const newCredits = Math.max(0, 3 - validTimes.length);
      setReportCredits(prev => (prev === newCredits ? prev : newCredits));
    };

    updateFromStorage();
    const interval = setInterval(updateFromStorage, 1000);
    return () => clearInterval(interval);
  }, [getCreditStorageKey]);
  
  useEffect(() => {
    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000;
    const newCooldowns = creditConsumptionTimes
      .filter(timestamp => (now - timestamp) < tenMinutes)
      .map(timestamp => timestamp + tenMinutes);

    setActiveCooldowns(newCooldowns);

    if (newCooldowns.length > 0) {
      const nextMs = Math.max(0, Math.min(...newCooldowns) - now);
      setCooldownRemaining(Math.ceil(nextMs / 1000));
    } else {
      setCooldownRemaining(0);
    }

    setCooldownActive(reportCredits === 0 && newCooldowns.length > 0);
  }, [creditConsumptionTimes, reportCredits]);

  useEffect(() => {
    if (!currentUser?.id) return;
    
    const creditsKey = getCreditStorageKey('reportCredits');
    const timesKey = getCreditStorageKey('creditConsumptionTimes');
    
    if (creditsKey && timesKey) {
      localStorage.setItem(creditsKey, reportCredits.toString());
      localStorage.setItem(timesKey, JSON.stringify(creditConsumptionTimes));
    }
  }, [reportCredits, creditConsumptionTimes, currentUser?.id, getCreditStorageKey]);


  useEffect(() => {
    let locationInitTimer: ReturnType<typeof setTimeout> | null = null;

    const initialize = async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData?.session?.user) {
        onLogout();
        return;
      }
      const user = sessionData.session.user;

      // Try to fetch profile from API
      let userProfile = null;
      const cache = readCachedProfile();
      let usedCache = false;

      try {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        userProfile = data;
        writeCachedProfile(data); // Cache the fresh data
      } catch (error: any) {
        console.warn("Failed to fetch user profile:", error);
        // Use cached profile as fallback
        if (cache && cache.user.id === user.id) {
          console.log("Using cached user profile as fallback");
          userProfile = cache.user;
          usedCache = true;
        } else {
          console.warn("No cached profile available, logging out");
          onLogout();
          return;
        }
      }

      if (!userProfile) {
        onLogout();
        return;
      }

      setCurrentUser(userProfile);
      setStoreCurrentUser(userProfile);
      setEditingMobileNumber(formatMobileNumberForInput(userProfile.mobileNumber));
      setEditingUsername(userProfile.username || '');

      await Promise.all([
        loadNotifications(user.id),
        loadUserReports(user.id),
        loadMdrrmoInfo(),
        loadBulanHotlines(),
        loadActiveAdvisory(),
      ]);

      setupRealtime(user.id);
      
      locationInitTimer = setTimeout(() => {
        void ensureLocationReady();
      }, 100);
      
      reconcileCooldownsAndCredits();
    };
    
    initialize();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user?.id !== currentUser?.id) {
          initialize();
        }
      } else if (event === 'SIGNED_OUT') {
        onLogout();
      }
    });

    return () => {
      cleanupRealtime();
      authListener?.subscription?.unsubscribe();
      if (locationInitTimer) {
        clearTimeout(locationInitTimer);
      }
    };
  }, []); // Run only once on mount

  useEffect(() => {
    if (isNativePlatform) return;
    const handleVisibility = () => {
      if (typeof document === 'undefined') return;
      const state = document.visibilityState;
      if (state === 'hidden') {
        lastHiddenAtRef.current = Date.now();
      } else if (state === 'visible') {
        const hiddenFor = lastHiddenAtRef.current ? Date.now() - lastHiddenAtRef.current : Number.POSITIVE_INFINITY;
        lastHiddenAtRef.current = null;
        void ensureLocationReady();
        if (hiddenFor >= MIN_HIDDEN_MS_BEFORE_REFRESH) {
          void silentRefresh();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isNativePlatform, silentRefresh, ensureLocationReady]);

  useEffect(() => {
    if (!isNativePlatform) return;
    let resumeListener: PluginListenerHandle | undefined;
    App.addListener('resume', () => {
      void ensureLocationReady();
      if (currentUser?.id) {
        void silentRefresh();
        const intentKey = `mdrrmo_${currentUser.id}_notificationIntent`;
        const intent = localStorage.getItem(intentKey);
        if (intent) {
          try {
            const { emergencyReportId, timestamp } = JSON.parse(intent);
            if (Date.now() - timestamp < 60000) {
              const report = userReports.find(r => r.id === emergencyReportId);
              if (report) {
                setDeepLinkedReport(report);
                setIsReportDetailModalOpen(true);
              }
            }
          } catch (e) {
            console.error("Error parsing notification intent:", e);
          }
          localStorage.removeItem(intentKey);
        }
      }
    })
      .then((handle: PluginListenerHandle) => { resumeListener = handle; })
      .catch(() => {});
    return () => {
      try { resumeListener?.remove(); } catch {}
    };
  }, [isNativePlatform, silentRefresh, currentUser?.id, ensureLocationReady, userReports]);

  useEffect(() => {
    if (isNativePlatform || !currentUser?.id) return;

    const checkIntent = () => {
      const intentKey = `mdrrmo_${currentUser.id}_notificationIntent`;
      const intent = localStorage.getItem(intentKey);
      if (intent) {
        try {
          const { emergencyReportId, timestamp } = JSON.parse(intent);
          if (Date.now() - timestamp < 60000) {
            const report = userReports.find(r => r.id === emergencyReportId);
            if (report) {
              setDeepLinkedReport(report);
              setIsReportDetailModalOpen(true);
            }
          }
        } catch (e) {
          console.error("Error parsing notification intent:", e);
        }
        localStorage.removeItem(intentKey);
      }
    };

    const interval = setInterval(checkIntent, 1000);
    return () => clearInterval(interval);
  }, [currentUser?.id, isNativePlatform, userReports]);

  useEffect(() => {
    if (!isNativePlatform || !currentUser?.id) return;
    initMobileState(currentUser.id);
    const notifSub = notifications$.subscribe((list: MobileNotification[]) => setNotifications(list as any));
    const reportsSub = mobileUserReports$.subscribe((list: MobileReport[]) => setUserReports(list as any));
    return () => {
      try { notifSub.unsubscribe() } catch {}
      try { reportsSub.unsubscribe() } catch {}
      destroyMobileState();
    };
  }, [isNativePlatform, currentUser?.id]);


  const confirmSOS = async (emergencyType: string) => {
    if (!currentUser) {
      console.error("User not logged in");
      return;
    }

    let effectiveLocation = location;
    if (!effectiveLocation) {
      effectiveLocation = await getFreshLocation(10000);
      if (!effectiveLocation) {
        console.error('Unable to acquire location for SOS');
      }
    }
    if (!effectiveLocation) {
      alert('Location is required to send an emergency alert. Please enable location services and try again.');
      return;
    }

    const requiresCasualties = [
      'Medical Emergency', 
      'Vehicular Incident', 
      'Public Disturbance'
    ].includes(selectedIncidentTypeForConfirmation || '');

    if (requiresCasualties) {
      if (!casualties) {
        alert('Please enter the number of casualties before sending the alert.');
        return;
      }
      
      const casualtiesNum = parseInt(casualties);
      if (isNaN(casualtiesNum) || casualtiesNum < 0) {
        alert('Please enter a valid number of casualties (0 or greater).');
        return;
      }
    }

    const currentCredits = reportCredits;
    if (currentCredits <= 0) {
      console.log("No credits remaining. Cannot send alert.");
      setShowSOSConfirm(false);
      return;
    }

    setIsEmergencyActive(true);
    setShowSOSConfirm(false);
    
    const consumptionTime = Date.now();
    provisionalTimeRef.current = consumptionTime;
    
    setReportCredits(prev => {
      const newCredits = Math.max(0, prev - 1);
      return newCredits;
    });
    
    setActiveCooldowns(prev => [...prev, consumptionTime + (10 * 60 * 1000)]);
    
    setCreditConsumptionTimes(prev => [...prev, consumptionTime]);

    try {
      const timesKey = getCreditStorageKey('creditConsumptionTimes');
      const creditsKey = getCreditStorageKey('reportCredits');
      if (timesKey) {
        const nextTimes = [...creditConsumptionTimes, consumptionTime];
        localStorage.setItem(timesKey, JSON.stringify(nextTimes));
      }
      if (creditsKey) {
        const nextCredits = Math.max(0, reportCredits - 1);
        localStorage.setItem(creditsKey, nextCredits.toString());
      }
    } catch {}

    try {
      let locationAddress = `${effectiveLocation.lat.toFixed(6)}, ${effectiveLocation.lng.toFixed(6)}`;
      if (isOnline) {
        try {
          const response = await fetch(
            `/api/geocode?lat=${effectiveLocation.lat}&lon=${effectiveLocation.lng}`
          );
          if (response.ok) {
            const data = await response.json();
            locationAddress = data.display_name || locationAddress;
          }
        } catch (err) {
          console.error("Geocoding error:", err);
        }
      }

      const reportEmergencyType = selectedIncidentTypeForConfirmation === 'Others' 
        ? `Other: ${customEmergencyType}` 
        : emergencyType;

      const requiresCasualties = [
        'Medical Emergency', 
        'Vehicular Incident', 
        'Public Disturbance'
      ].includes(selectedIncidentTypeForConfirmation || '');

      const casualtiesNumber = requiresCasualties && casualties
        ? Number.parseInt(casualties, 10)
        : undefined;

      const queueTimestamp = Date.now();
      const queueId = `queued-${queueTimestamp}`;
      const clientTimestamp = new Date(consumptionTime).toISOString();

      const resetAfterSubmit = () => {
        setSelectedIncidentTypeForConfirmation(null);
        setCustomEmergencyType('');
        setShowCustomEmergencyInput(false);
        setCasualties('');
        setTimeout(() => {
          setIsEmergencyActive(false);
        }, 5000);
      };

      const payload: Record<string, any> = {
        emergencyType: reportEmergencyType,
        latitude: effectiveLocation.lat,
        longitude: effectiveLocation.lng,
        locationAddress,
        clientTimestamp,
      };

      if (typeof casualtiesNumber === 'number' && Number.isFinite(casualtiesNumber)) {
        payload.casualties = casualtiesNumber;
      }

      try {
        const response = await fetch('/api/emergency/report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          try {
            await response.json();
          } catch {}
          resetAfterSubmit();
          return;
        }

        if (response.status === 202) {
          let queuedInfo: any = null;
          try {
            queuedInfo = await response.json();
          } catch {}
          const storedTimestamp = typeof queuedInfo?.queueTimestamp === 'number' ? queuedInfo.queueTimestamp : queueTimestamp;
          const storedId = queuedInfo?.queueId ? String(queuedInfo.queueId) : queueId;
          addQueuedReport({
            id: storedId,
            createdAt: clientTimestamp,
            queueTimestamp: storedTimestamp,
            emergencyType: reportEmergencyType,
            location: locationAddress,
          });
          resetAfterSubmit();
          return;
        }

        const errorPayload = await response.json().catch(() => ({}));
        console.error('Error creating report:', errorPayload);
        setIsEmergencyActive(false);
        setCreditConsumptionTimes(prev => prev.filter(t => t !== consumptionTime));
        setReportCredits(prev => Math.min(3, prev + 1));
        return;
      } catch (error: any) {
        console.error('SOS Error:', error);
        addQueuedReport({
          id: queueId,
          createdAt: clientTimestamp,
          queueTimestamp,
          emergencyType: reportEmergencyType,
          location: locationAddress,
        });
        resetAfterSubmit();
        return;
      }
    } catch (error: any) {
      console.error("SOS Error:", error);
      console.error("Failed to send emergency alert: " + error.message);
      setIsEmergencyActive(false);
    }
  }

  const cancelSOS = () => {
    setShowSOSConfirm(false);
    setShowCustomEmergencyInput(false);
    setSelectedIncidentTypeForConfirmation(null);
    setCustomEmergencyType('');
    setCasualties('');
  }

  const handleLogout = async () => {
    console.log("LOGOUT FUNCTION CALLED!")
    setShowLogoutConfirm(true)
  }

  const confirmLogout = async () => {
    try {
      localStorage.removeItem("mdrrmo_user");
      setShowUserMenu(false);
      setShowLogoutConfirm(false);
      onLogout();
    } catch (err) {
      console.error("Error during logout:", err);
        onLogout();
    }
  }

  const handleUserMenuClick = (e: React.MouseEvent) => {
    console.log("User menu clicked!")
    e.preventDefault()
    e.stopPropagation()
    setShowUserMenu(!showUserMenu)
  }

  const markAllAsRead = async () => {
    if (!currentUser) return;
    const { error } = await supabase
      .from("user_notifications")
      .update({ is_read: true })
      .eq("user_id", currentUser.id)
      .eq("is_read", false);
    if (!error) {
      await loadNotifications(currentUser.id);
    } else {
      console.error("Error marking all as read:", error);
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from('user_notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      console.error("Error marking notification as read:", error);
    } else {
      await loadNotifications(currentUser.id);
    }
  };

  const sendProfileOtp = async () => {
    if (!mobileNumberHasChanged) {
      setProfileOtpError("Mobile number has not changed.");
      setProfileOtpSuccess(null);
      return;
    }
    if (editingMobileNumber.length !== 10) {
      setMobileNumberError('Please complete the mobile number (10 digits required).');
      setProfileOtpError("Please provide a valid mobile number before requesting a code.");
      setProfileOtpSuccess(null);
      return;
    }

    setIsProfileOtpSending(true);
    setProfileOtpError(null);
    setProfileOtpSuccess(null);
    setProfileOtpCode('');

    try {
      const response = await fetch("/api/semaphore/otp/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mobileNumber: editingMobileNumber }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to send verification code.");
      }

      if (!data?.messageId) {
        throw new Error("Semaphore did not return a verification reference.");
      }

      setProfileOtpMessageId(data.messageId);
      setProfileOtpSuccess("Verification code sent to your mobile number.");
      setIsProfileOtpVerified(false);
      setProfileOtpResendTimer(60);
    } catch (error: any) {
      setProfileOtpError(error?.message || "Failed to send verification code.");
    } finally {
      setIsProfileOtpSending(false);
    }
  };

  const verifyProfileOtp = async () => {
    if (!profileOtpMessageId) {
      setProfileOtpError("Please request a verification code first.");
      return;
    }

    if (!profileOtpCode.trim()) {
      setProfileOtpError("Please enter the verification code.");
      return;
    }

    setIsProfileOtpVerifying(true);
    setProfileOtpError(null);
    setProfileOtpSuccess(null);

    try {
      const response = await fetch("/api/semaphore/otp/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messageId: profileOtpMessageId, code: profileOtpCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Verification failed.");
      }

      setIsProfileOtpVerified(true);
      setProfileOtpSuccess("Mobile number verified.");
    } catch (error: any) {
      setIsProfileOtpVerified(false);
      setProfileOtpError(error?.message || "Verification failed.");
    } finally {
      setIsProfileOtpVerifying(false);
    }
  };

  const handleProfileUpdate = async () => {
    if (!currentUser) {
      setProfileEditError("User not logged in.");
      return;
    }
    setProfileEditSuccess(null);
    setProfileEditError(null);

    if (!/^09\d{9}$/.test(editingMobileNumber)) {
      setMobileNumberError('Please provide a valid mobile number starting with 09 (11 digits).');
      return;
    }

    if (mobileNumberHasChanged && !isProfileOtpVerified) {
      setProfileEditError("Please verify the new mobile number before updating.");
      setProfileOtpError("Please verify the new mobile number before updating.");
      return;
    }

    try {
      const digits = editingMobileNumber.replace(/\D/g, '');
      const fullMobileNumber = digits.startsWith('09') ? `63${digits.slice(1)}` : digits;
      const { data, error } = await supabase
        .from('users')
        .update({
          mobileNumber: fullMobileNumber,
          username: editingUsername,
        })
        .eq('id', currentUser.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setCurrentUser(data);
      setEditingMobileNumber(formatMobileNumberForInput(data.mobileNumber));
      setProfileEditSuccess("Profile updated successfully!");
      writeCachedProfile(data);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      setProfileEditError(`Failed to update profile: ${error.message || 'Unknown error'}. Please check your Supabase RLS policies for 'users' UPDATE operation.`);
    }
  };

  const handleSendFeedback = async () => {
    if (!currentUser) return;
    const trimmed = feedbackText.trim();
    if (!trimmed) {
      setFeedbackErrorMessage('Feedback cannot be empty.');
      return;
    }
    if (trimmed.length < FEEDBACK_MIN) {
      setFeedbackErrorMessage(`Please provide at least ${FEEDBACK_MIN} characters.`);
      return;
    }
    if (trimmed.length > FEEDBACK_MAX) {
      setFeedbackErrorMessage(`Maximum ${FEEDBACK_MAX} characters allowed.`);
      return;
    }

    setIsSendingFeedback(true);
    setFeedbackSentMessage(null);
    setFeedbackErrorMessage(null);

    try {
      const finalText = trimmed;

      const { error } = await supabase
        .from('user_feedback')
        .insert({
          user_id: currentUser.id,
          feedback_text: finalText,
          category: feedbackCategory as any,
          rating: feedbackRating || null,
          created_at: new Date().toISOString(),
          is_read: false,
        });

      if (error) throw error;

      setFeedbackText('');
      setFeedbackRating(0);
      setFeedbackCategory('bug');
      setFeedbackSentMessage('Feedback sent successfully!');
    } catch (error: any) {
      console.error('Error sending feedback:', error);
      setFeedbackErrorMessage(`Failed to send feedback: ${error?.message || 'Unknown error'}.`);
    } finally {
      setIsSendingFeedback(false);
    }
  };

  const handleIncidentTypeClick = (type: string) => {
    if (cooldownActive || reportCredits === 0) {
      console.log("Cannot send alert: Cooldown active or no credits remaining.");
      return;
    }
    setCasualties('');
    
    if (type === 'Others') {
      setShowCustomEmergencyInput(true);
      setSelectedIncidentTypeForConfirmation('Others');
    } else {
      setShowCustomEmergencyInput(false);
      setSelectedIncidentTypeForConfirmation(type);
      setShowSOSConfirm(true);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (isUserBanned) {
    return (
      <div className="min-h-screen bg-white">
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-white/95 backdrop-blur-sm shadow-2xl">
            <CardHeader className="bg-red-600 text-white rounded-t-lg">
              <CardTitle className="text-xl font-bold">Account Banned</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <p className="text-gray-800">Your account is currently banned and you cannot use the app.</p>
              {currentUser?.ban_reason && (
                <p className="text-sm"><span className="font-semibold">Reason:</span> {currentUser.ban_reason}</p>
              )}
              {currentUser?.banned_until ? (
                <p className="text-sm">
                  <span className="font-semibold">Duration:</span>{' '}
                  Until {new Date(currentUser.banned_until).toLocaleString()}
                </p>
              ) : (
                <p className="text-sm">This ban is currently permanent.</p>
              )}
              <p className="text-sm text-gray-600">
                If you believe this is an error, please contact MDRRMO support.
              </p>
              <Button onClick={() => router.push('/')} className="w-full">Return to Login</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gray-100 pb-20 lg:pb-24"
      style={{
        backgroundImage: "url('/images/mdrrmo_dashboard_bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <ReportDetailModal
        report={deepLinkedReport}
        isOpen={isReportDetailModalOpen}
        onClose={() => setIsReportDetailModalOpen(false)}
      />

      {isRefreshing && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div className="absolute top-2 right-2 bg-black/60 text-white px-3 py-2 rounded-md text-sm flex items-center space-x-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            <span>Refreshing…</span>
          </div>
        </div>
      )}
      <div className="absolute inset-0 bg-black/30 z-0"></div>
      
      <LocationPermissionModal
        open={showLocationModal}
        onOpenChange={setShowLocationModal}
        onRequestPermission={handleRequestLocation}
        error={locationError}
      />

      <div className="relative min-h-screen">
        <div className="sticky top-0 z-30 bg-orange-500/95 backdrop-blur-sm text-white p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button 
                onClick={() => {
                  if (isTabletOrDesktop) {
                    setIsSidebarVisible(!isSidebarVisible)
                  } else {
                    setIsSidebarOpen(!isSidebarOpen)
                  }
                }} 
                className="p-2 -ml-2 rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Toggle menu"
              >
                <Menu className="w-6 h-6" />
              </button>
              
              <div className="hidden md:flex items-center space-x-3 ml-2">
                <span className="font-medium text-lg">BULAN EMERGENCY APP</span>
              </div>
            </div>

            <div className="text-center flex-1">
              <h1 className="text-xl sm:text-2xl font-bold">MDRRMO</h1>
              <p className="text-sm sm:text-base text-orange-100">Bulan Emergency App</p>
            </div>

            <div className="flex items-center space-x-4">
              <div className="relative">
                <button
                  ref={notificationsButtonRef}
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 hover:bg-orange-600 rounded-full transition-colors relative"
                  aria-label={showNotifications ? 'Hide notifications' : 'Show notifications'}
                  aria-expanded={showNotifications}
                >
                  <Bell className="w-6 h-6" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadNotificationsCount}
                    </span>
                  )}
                </button>
              </div>

              <div className="relative">
                <button
                  onClick={() => window.location.reload()}
                  className="p-2 hover:bg-orange-600 rounded-full transition-colors"
                  aria-label="Refresh now"
                  title="Refresh now"
                >
                  <RefreshCcw className="w-6 h-6" />
                </button>
              </div>

              <div className="relative">
                <div
                  className="flex items-center space-x-2 cursor-pointer hover:bg-orange-600 p-2 rounded-full transition-colors"
                  onClick={handleUserMenuClick}
                >
                  <User className="w-6 h-6" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-h-[calc(100vh-80px)]">
          {isTabletOrDesktop && isSidebarVisible && (
            <>
              <div 
                className="fixed inset-0 bg-black/50 z-30"
                onClick={() => setIsSidebarVisible(false)}
              />
              <div className="fixed top-20 left-0 h-[calc(100vh-80px)] w-64 z-40">
                <UserSidebar 
                  isOpen={true} 
                  onClose={() => setIsSidebarVisible(false)}
                  onChangeView={(view: string) => {
                    setCurrentView(view as typeof currentView)
                    setIsSidebarVisible(false) // Close sidebar after navigation
                  }}
                />
              </div>
            </>
          )}

          {!isTabletOrDesktop && (
            <UserSidebar 
              isOpen={effectiveSidebarOpen} 
              onClose={() => setIsSidebarOpen(false)}
              onChangeView={(view: string) => setCurrentView(view as typeof currentView)}
            />
          )}

          <div className="flex-1 flex flex-col items-center p-4 sm:p-8 min-h-full">
            {currentView === 'main' && (
              <>
                {activeAdvisory ? (
                  <Card className="w-full max-w-2xl mx-auto mb-6 bg-white/90 backdrop-blur-sm shadow-lg rounded-lg border border-orange-300">
                    <CardHeader className="pb-2 flex flex-col items-center justify-center">
                      <Megaphone className="w-12 h-12 text-orange-600 mb-2" />
                      <CardTitle className="text-lg sm:text-xl font-bold text-orange-700 text-center mt-2">{activeAdvisory.title || 'MDRRMO Advisory'}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center text-gray-700 text-sm sm:text-base whitespace-pre-wrap">
                      {activeAdvisory.body || ''}
                    </CardContent>
                  </Card>
                ) : (
              <Card className="w-full max-w-2xl mx-auto mb-6 bg-white/90 backdrop-blur-sm shadow-lg rounded-lg border border-orange-300">
                <CardHeader className="pb-2 flex flex-col items-center justify-center">
                  <img
                    src="/images/logo.png"
                    alt="MDRRMO Logo"
                    className="w-20 h-20 object-contain mb-2 mx-auto"
                    style={{ maxWidth: '80px', maxHeight: '80px' }}
                  />
                  <CardTitle className="text-lg sm:text-xl font-bold text-orange-700 text-center mt-2">WELCOME TO MDRRMO BULAN EMERGENCY APP</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-gray-700 text-sm sm:text-base">
                  MAARI LAMANG I-ISKROL PAIBABA AT PUMILI NG TAMANG KLASENG INSIDENTE PARA MAKAPAG-REPORT
                
                  <CardContent className="text-center text-red-700 text-sm sm:text-base"></CardContent>
                  Available max credit is 3, Every Credits will be refreshed in 10 minutes
                </CardContent>
              </Card>
            )}
            <div className="text-center mb-8">
              <div className="space-y-2">
                <p className="text-white text-lg sm:text-xl font-semibold bg-black/50 p-3 rounded-lg shadow-md">
                  {`You have ${reportCredits} Credits left`}
                </p>
                {cooldownActive && (
                  <div className="bg-yellow-500 text-white px-6 py-3 rounded-full shadow-lg text-lg sm:text-xl font-bold">
                    Cooldown: {formatTime(cooldownRemaining)}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 max-w-3xl w-full mx-auto mb-24">
              {INCIDENT_TYPES.map((incident) => {
                const IconComponent = incident.icon;
                const isDisabled = cooldownActive || reportCredits === 0;
                const isSelected = selectedIncidentTypeForConfirmation === incident.type;

                return (
                  <div 
                    key={incident.type}
                    className={`relative group ${isDisabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                    onClick={isDisabled ? undefined : () => handleIncidentTypeClick(incident.type)}
                  >
                    <div className={`
                      flex flex-col items-center justify-center p-5 sm:p-6 rounded-lg 
                      bg-white/75 border-2 border-orange-400 shadow-md hover:shadow-lg 
                      transition-all duration-200 h-full backdrop-blur-sm
                      ${isSelected ? 'ring-2 ring-orange-500 scale-[1.02]' : ''}
                      ${isDisabled ? 'bg-gray-100/75' : 'hover:bg-orange-50/75'}
                    `}>
                      <div className={`
                        w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center 
                        mb-3 transition-colors duration-200
                        ${isDisabled ? 'bg-gray-300' : 'bg-orange-100 group-hover:bg-orange-200'}
                        ${isSelected ? 'bg-orange-200' : ''}
                      `}>
                        <IconComponent className={`
                          w-8 h-8 sm:w-10 sm:h-10 
                          ${isDisabled ? 'text-gray-600' : incident.type === 'Others' ? 'text-orange-500' : 'text-orange-600'}
                        `} />
                      </div>
                      <span className={`
                        text-center font-semibold text-sm sm:text-base
                        ${isDisabled ? 'text-gray-600' : 'text-gray-800'}
                      `}>
                        {incident.type}
                      </span>
                    </div>
                    {isSelected && !isDisabled && (
                      <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                        !
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {isEmergencyActive && (
              <div className="mt-6 bg-red-500 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-full animate-bounce text-sm sm:text-base shadow-xl">
                <span className="font-bold">🚨 EMERGENCY ALERT SENT! 🚨</span>
              </div>
            )}
          </>
        )}

        {currentView === 'reportHistory' && (
          <div className="w-full h-full p-1 sm:p-2">
            <Card className="w-full h-full bg-white/90 backdrop-blur-sm shadow-lg rounded-lg p-2 sm:p-4 flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg sm:text-xl font-bold text-gray-800">Your Report History</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                {(reportsSource?.length || 0) === 0 ? (
                  <p className="text-gray-600 text-center py-4">No emergency reports found.</p>
                ) : (
                  <>
                    <div className="block sm:hidden space-y-2">
                      {paginatedReports.map((report: Report) => (
                        <div key={report.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium text-gray-900 text-sm">{report.emergency_type}</span>
                            <span className={`px-2 py-0.5 text-xs leading-4 font-semibold rounded-full ${
                              report.status.trim().toLowerCase() === 'pending' || report.status.trim().toLowerCase() === 'active'
                                ? 'bg-red-100 text-red-800'
                                : report.status.trim().toLowerCase() === 'responded'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-green-100 text-green-800'
                            }`}>
                              {report.status}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600 mb-1">
                            <span className="font-medium">Response:</span> {report.admin_response || 'N/A'}
                          </div>
                          <div className="text-xs text-gray-500">
                            <span className="font-medium">Resolved:</span> {report.resolved_at ? new Date(report.resolved_at).toLocaleString() : 'N/A'}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="hidden sm:block h-full overflow-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th scope="col" className="px-2 py-1 text-left font-medium text-gray-500 uppercase tracking-wider w-1/4">
                              Type
                            </th>
                            <th scope="col" className="px-2 py-1 text-left font-medium text-gray-500 uppercase tracking-wider w-1/4">
                              Status
                            </th>
                            <th scope="col" className="px-2 py-1 text-left font-medium text-gray-500 uppercase tracking-wider w-1/3">
                              Team Responded
                            </th>
                            <th scope="col" className="px-2 py-1 text-left font-medium text-gray-500 uppercase tracking-wider w-1/4">
                              Time and Date Resolved
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {paginatedReports.map((report: Report) => (
                            <tr key={report.id}>
                              <td className="px-2 py-2 whitespace-nowrap text-gray-900 font-medium">{report.emergency_type}</td>
                              <td className="px-2 py-2 whitespace-nowrap">
                                <span className={`px-1 py-0.5 text-xs leading-4 font-semibold rounded-full ${
                                  report.status.trim().toLowerCase() === 'pending' || report.status.trim().toLowerCase() === 'active'
                                    ? 'bg-red-100 text-red-800'
                                    : report.status.trim().toLowerCase() === 'responded'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-green-100 text-green-800'
                                }`}>
                                  {report.status}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-gray-500 break-words max-w-0">{report.admin_response || 'N/A'}</td>
                              <td className="px-2 py-2 whitespace-nowrap text-gray-500">{report.resolved_at ? new Date(report.resolved_at).toLocaleString() : 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="flex items-center justify-between mt-2 px-2">
                      <div className="text-xs text-gray-600">
                        Page {reportPage} of {totalReportPages}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReportPage(p => Math.max(1, p - 1))}
                          disabled={reportPage <= 1}
                          className="text-xs px-2 py-1"
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReportPage(p => Math.min(totalReportPages, p + 1))}
                          disabled={reportPage >= totalReportPages}
                          className="text-xs px-2 py-1"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {currentView === 'incidentPosts' && (
          <Card className="w-full bg-white/90 backdrop-blur-sm shadow-lg rounded-lg">
            <CardHeader className="px-4 sm:px-6 pt-4 pb-3 border-b border-gray-200">
              <CardTitle className="text-xl sm:text-2xl font-bold text-gray-800">MDRRMO Incident Posts</CardTitle>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">Read the latest narratives published by MDRRMO. Use the search to find specific incidents.</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-4 sm:p-6 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    value={incidentPostsSearch}
                    onChange={(event) => setIncidentPostsSearch(event.target.value)}
                    placeholder="Search incident posts..."
                    className="pl-9"
                  />
                </div>

                {incidentPostsLoading ? (
                  <div className="flex items-center justify-center py-10 gap-2 text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading posts...
                  </div>
                ) : incidentPostsError ? (
                  <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                    {incidentPostsError}
                  </div>
                ) : incidentPosts.length === 0 ? (
                  <div className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                    No incident posts found.
                  </div>
                ) : (
                  <div className="space-y-5">
                    {incidentPosts.map((post) => (
                      <Card key={post.id} className="w-full bg-white/95 backdrop-blur-sm shadow-lg rounded-lg overflow-hidden border border-gray-200">
                        <CardContent className="p-0">
                          {/* Text Content First */}
                          <div className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="text-lg font-semibold text-gray-900 break-words flex-1">{post.title}</h3>
                              <Badge variant="outline" className="shrink-0 border-orange-200 bg-orange-50 text-orange-700">
                                {post.internal_report_id ? `Report #${post.internal_report_id}` : "Incident"}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-500">
                              {post.published_at
                                ? `Published ${formatDistanceToNow(new Date(post.published_at), { addSuffix: true })}`
                                : `Created ${formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}`}
                            </p>
                            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700">
                              {post.narrative_text}
                            </p>
                          </div>

                          {/* Image Below Text (Facebook-style) */}
                          {post.image_url ? (
                            <div className="relative bg-gray-50 border-t border-gray-100">
                              <img
                                src={post.image_url}
                                alt={post.title}
                                className="w-full object-contain max-h-64 sm:max-h-80 lg:max-h-96"
                                style={{ aspectRatio: 'auto' }}
                              />
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-center gap-3 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={incidentPostsLoading || incidentPostsPage <= 1}
                    onClick={() => setIncidentPostsPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-gray-500">
                    Page {incidentPostsTotalPages === 0 ? 0 : incidentPostsPage} of {incidentPostsTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={incidentPostsLoading || incidentPostsPage >= incidentPostsTotalPages}
                    onClick={() => setIncidentPostsPage((prev) => Math.min(incidentPostsTotalPages, prev + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentView === 'mdrrmoInfo' && (
          <div className="space-y-6">
            {/* MDRRMO Information Section */}
            <Card className="w-full max-w-full lg:max-w-4xl bg-white/90 backdrop-blur-sm shadow-lg rounded-lg p-4 sm:p-6">
              <CardHeader>
                <CardTitle className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center">
                  <Info className="mr-2 h-6 w-6 text-blue-600" />
                  Bulan Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                {mdrrmoInformation ? (
                  <div className="prose max-w-none text-gray-700 text-base sm:text-lg">
                    <p className="whitespace-pre-wrap">{mdrrmoInformation.content}</p>
                  </div>
                ) : (
                  <p className="text-gray-600 text-center py-4">No information available yet. Please check back later.</p>
                )}
              </CardContent>
            </Card>

            {/* Hotlines Section */}
            <Card className="w-full max-w-full lg:max-w-4xl bg-white/90 backdrop-blur-sm shadow-lg rounded-lg p-4 sm:p-6">
              <CardHeader>
                <CardTitle className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center">
                  <Phone className="mr-2 h-6 w-6 text-green-600" />
                  Emergency Hotlines
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bulanHotlines.length === 0 ? (
                  <p className="text-gray-600 text-center py-4">No hotlines available yet. Please check back later.</p>
                ) : (
                  <div className="space-y-4">
                    {bulanHotlines.map((hotline) => (
                      <div key={hotline.id} className="border-b pb-3 last:border-b-0">
                        <h3 className="text-lg sm:text-xl font-semibold text-gray-800">{hotline.name}</h3>
                        <p className="text-blue-600 font-medium text-xl sm:text-2xl mt-1">
                          <a href={`tel:${hotline.number}`} className="hover:underline">{hotline.number}</a>
                        </p>
                        {hotline.description && <p className="text-sm sm:text-base text-gray-600 mt-1">{hotline.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {currentView === 'userProfile' && currentUser && (
          <Card className="w-full max-w-md bg-white/90 backdrop-blur-sm shadow-lg rounded-lg p-4 sm:p-6">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl font-bold text-gray-800">User Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <Input
                  id="username"
                  type="text"
                  value={editingUsername}
                  onChange={(e) => setEditingUsername(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label htmlFor="mobileNumber" className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                  <Input 
                    id="mobileNumber" 
                    type="tel" 
                    value={editingMobileNumber} 
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
                      if (value.length <= 11) {
                        const hasChanged = formattedCurrentMobile ? value !== formattedCurrentMobile : value.length > 0;
                        setEditingMobileNumber(value);
                        if (!/^09\d{0,9}$/.test(value)) {
                          setMobileNumberError('Please enter a valid PH mobile number starting with 09.');
                        } else if (value.length < 11) {
                          setMobileNumberError('Please complete the mobile number (11 digits required).');
                        } else {
                          setMobileNumberError(null);
                        }
                        resetProfileOtpProgress(!hasChanged);
                      }
                    }}
                    maxLength={11}
                    className={`${mobileNumberError ? 'border-red-500' : ''}`}
                    placeholder="09XXXXXXXXX"
                  />
                  {mobileNumberError && <p className="mt-2 text-sm text-red-600">{mobileNumberError}</p>}
                  <p className="mt-2 text-sm text-gray-600">Current saved number: {profileMobileDisplay || 'Not set'}</p>
                  {mobileNumberHasChanged && (
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          id="profileOtpCode"
                          value={profileOtpCode}
                          onChange={(e) => setProfileOtpCode(e.target.value.replace(/\D/g, ''))}
                          maxLength={6}
                          placeholder="Enter code"
                          disabled={isProfileOtpVerified}
                          className="w-28 sm:w-32"
                        />
                        <Button
                          type="button"
                          onClick={sendProfileOtp}
                          disabled={isProfileOtpSending || profileOtpResendTimer > 0 || isProfileOtpVerified}
                          className="bg-orange-500 hover:bg-orange-600 text-white"
                        >
                          {isProfileOtpSending
                            ? 'Sending...'
                            : profileOtpResendTimer > 0
                              ? `Resend in ${profileOtpResendTimer}s`
                              : isProfileOtpVerified
                                ? 'Verified'
                                : 'Send OTP'}
                        </Button>
                        <Button
                          type="button"
                          onClick={verifyProfileOtp}
                          disabled={isProfileOtpVerifying || !profileOtpMessageId || !profileOtpCode.trim() || isProfileOtpVerified}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          {isProfileOtpVerifying ? 'Verifying...' : 'Verify'}
                        </Button>
                      </div>
                      {profileOtpError && <p className="text-sm text-red-600">{profileOtpError}</p>}
                      {profileOtpSuccess && <p className="text-sm text-green-600">{profileOtpSuccess}</p>}
                    </div>
                  )}
              </div>
              <Button onClick={handleProfileUpdate} disabled={!!mobileNumberError} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-lg">
                <Edit className="mr-2 h-4 w-4" /> Update Profile
              </Button>
              {profileEditSuccess && <p className="text-green-600 text-sm mt-2 text-center">{profileEditSuccess}</p>}

            </CardContent>
          </Card>
        )}

        {currentView === 'sendFeedback' && currentUser && (
          <Card className="w-full max-w-full sm:max-w-2xl bg-white/90 backdrop-blur-sm shadow-lg rounded-lg p-4 sm:p-6 md:p-8 mx-auto">
            <CardHeader className="w-full px-3 sm:px-6 md:px-8 pb-2 sm:pb-4">
              <CardTitle className="text-base sm:text-2xl font-bold text-gray-800">Send Feedback</CardTitle>
            </CardHeader>
            <CardContent className="w-full space-y-4 sm:space-y-5 px-3 sm:px-6 md:px-8">
              {feedbackSentMessage && (
                <Alert className="border-green-300 bg-green-50">
                  <AlertTitle className="text-green-700">Success</AlertTitle>
                  <AlertDescription className="text-green-700">{feedbackSentMessage}</AlertDescription>
                </Alert>
              )}
              {feedbackErrorMessage && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{feedbackErrorMessage}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <Select value={feedbackCategory} onValueChange={(v: any) => setFeedbackCategory(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bug">Bug</SelectItem>
                      <SelectItem value="feature">Feature Request</SelectItem>
                      <SelectItem value="question">Question</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rating (optional)</label>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    {[1,2,3,4,5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setFeedbackRating(n === feedbackRating ? 0 : n)}
                        className="p-1.5 sm:p-2"
                        aria-label={`rate ${n}`}
                      >
                        <Star className={n <= feedbackRating ? 'w-6 h-6 fill-yellow-400 stroke-yellow-500' : 'w-6 h-6 text-gray-300'} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="feedback" className="block text-sm font-medium text-gray-700">Your Feedback</label>
                  <span className={`text-[11px] sm:text-xs ${feedbackText.length > FEEDBACK_MAX || feedbackTooShort ? 'text-red-600' : 'text-gray-500'}`}>{feedbackText.length}/{FEEDBACK_MAX}</span>
                </div>
                <Textarea
                  id="feedback"
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value.slice(0, FEEDBACK_MAX))}
                  rows={6}
                  placeholder="Describe the issue or request in detail..."
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 min-h-[160px] sm:min-h-[180px] text-sm sm:text-base ${feedbackTooShort ? 'focus:ring-red-500 border-red-300' : 'focus:ring-orange-500 border-gray-200'}`}
                />
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto justify-start sm:justify-center"
                    onClick={() => setFeedbackText(prev => (prev ? `${prev}\n` : '') + 'Bug: Steps to reproduce... Expected vs actual behavior...')}
                  >
                    <Wand2 className="h-4 w-4 mr-1" /> Bug template
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto justify-start sm:justify-center"
                    onClick={() => setFeedbackText(prev => (prev ? `${prev}\n` : '') + 'Feature Request: I would like to... Because...')}
                  >
                    <Wand2 className="h-4 w-4 mr-1" /> Feature template
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto justify-start sm:justify-center"
                    onClick={() => setFeedbackText(prev => (prev ? `${prev}\n` : '') + 'Question: ...')}
                  >
                    <Wand2 className="h-4 w-4 mr-1" /> Question template
                  </Button>
                </div>
              </div>

              <Button onClick={handleSendFeedback} disabled={isSendingFeedback || feedbackTooShort || !feedbackText.trim()} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">
                {isSendingFeedback ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>) : (<><Send className="mr-2 h-4 w-4" /> Send Feedback</>)}
              </Button>

              <div className="mt-6 sm:mt-8">
                <FeedbackHistory userId={currentUser.id} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Notifications Dropdown - Positioned relative to header */}
      {showNotifications && (
        <div 
          ref={notificationsRef}
          className="fixed top-20 right-4 bg-white rounded-lg shadow-xl border border-gray-200 w-72 sm:w-80 max-h-96 overflow-y-auto z-50 animate-in fade-in-50 slide-in-from-top-2"
        >
          <div className="sticky top-0 bg-white z-10 p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Notifications</h3>
            <button
              onClick={() => setShowNotifications(false)}
              className="text-gray-500 hover:text-gray-700 transition-colors p-1 -mr-2"
              aria-label="Close notifications"
            >
              <X className="w-5 h-5" />
            </button>
            {(notificationsSource || []).some(n => !n.is_read) && (
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs py-1 px-2 rounded-full ml-2"
                onClick={(e) => {
                  e.stopPropagation();
                  markAllAsRead();
                }}
              >
                Mark all as read
              </Button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {(notificationsSource?.length || 0) === 0 ? (
              <div className="p-4 text-gray-500 text-center">No notifications</div>
            ) : (
              notificationsSource!.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-gray-100 ${!notification.is_read ? "bg-blue-50" : ""}`}
                  onClick={async () => {
                    await markNotificationAsRead(notification.id);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <p className="text-sm text-gray-800">{notification.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{new Date(notification.created_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* User Menu Overlay (right side dropdown) - Positioned relative to header */}
      {showUserMenu && (
        <div
          className="fixed inset-0 bg-black/20 flex items-start justify-end pt-16 pr-4 z-40"
          onClick={() => setShowUserMenu(false)}
        >
          <div
            className="bg-white text-gray-800 rounded-lg shadow-2xl border border-gray-200 w-48 sm:w-56 animate-in slide-in-from-top-2 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
              <p className="text-sm font-medium text-gray-900">Hi {currentUser?.username || currentUser?.firstName || "User"}!</p>
              <p className="text-xs text-gray-500">{currentUser?.email || currentUser?.username}</p>
            </div>
            <div className="p-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <div className="flex items-center space-x-2 w-full p-3 hover:bg-red-50 hover:text-red-600 rounded text-left transition-colors cursor-pointer select-none">
                    <LogOut className="w-4 h-4" />
                    <span className="font-medium">Logout</span>
                  </div>
                </AlertDialogTrigger>
                <AlertDialogContent className="border-orange-200/50">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-orange-900">Logout confirmation</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to logout? You will need to log in again to access the dashboard.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-orange-200 text-orange-700 hover:bg-orange-50">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={confirmLogout}
                      className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                    >
                      Confirm Logout
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      )}

      {/* Custom Emergency Type Input Modal */}
      {showCustomEmergencyInput && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <HelpCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Describe Emergency</h3>
              <p className="text-gray-600 mb-4">
                Please describe the type of emergency you're reporting.
              </p>
              <Textarea
                value={customEmergencyType}
                onChange={(e) => setCustomEmergencyType(e.target.value)}
                placeholder="E.g., Power outage, Gas leak, etc."
                className="w-full mb-4 min-h-[100px]"
              />
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                <Button 
                  onClick={() => {
                    setShowCustomEmergencyInput(false);
                    setCustomEmergencyType('');
                  }} 
                  variant="outline" 
                  className="flex-1"
                >
                  CANCEL
                </Button>
                <Button 
                  onClick={() => {
                    if (customEmergencyType.trim()) {
                      setShowCustomEmergencyInput(false);
                      setShowSOSConfirm(true);
                    }
                  }}
                  disabled={!customEmergencyType.trim()}
                  className="flex-1 bg-red-500 hover:bg-red-600"
                >
                  CONFIRM
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SOS Confirmation Modal */}
      {showSOSConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Emergency Alert</h3>
              <p className="text-gray-600 mb-4">
                This will send your location and details for a <span className="font-bold text-red-700">
                  {selectedIncidentTypeForConfirmation === 'Others' ? customEmergencyType : selectedIncidentTypeForConfirmation}
                </span> emergency to MDRRMO emergency responders.
              </p>
              
              {/* Casualties Input for relevant emergency types */}
              {['Medical Emergency', 'Vehicular Incident', 'Public Disturbance'].includes(selectedIncidentTypeForConfirmation || '') && (
                <div className="mb-4">
                  <label htmlFor="casualties" className="block text-sm font-medium text-gray-700 mb-1">
                    Bilang ng involve sa insidente
                  </label>
                  <Input
                    id="casualties"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Enter number of casualties"
                    value={casualties}
                    onChange={(e) => {
                      // Only allow numeric input
                      const value = e.target.value;
                      if (value === '' || /^\d+$/.test(value)) {
                        setCasualties(value);
                      }
                    }}
                    className="w-full"
                  />
                  {!casualties && (
                    <p className="mt-1 text-sm text-red-600">Ilagay ang bilang ng involve sa insidente.</p>
                  )}
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                <Button onClick={cancelSOS} variant="outline" className="flex-1 bg-transparent">
                  CANCEL
                </Button>
                <Button 
                  onClick={() => confirmSOS(selectedIncidentTypeForConfirmation === 'Others' ? customEmergencyType : selectedIncidentTypeForConfirmation!)} 
                  disabled={['Medical Emergency', 'Vehicular Incident', 'Public Disturbance'].includes(selectedIncidentTypeForConfirmation || '') && !casualties}
                  className={`flex-1 bg-red-500 ${!['Medical Emergency', 'Vehicular Incident', 'Public Disturbance'].includes(selectedIncidentTypeForConfirmation || '') || casualties ? 'hover:bg-red-600' : 'opacity-50 cursor-not-allowed'}`}
                >
                  OKAY
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* Bottom Navigation */}
    <div className="fixed bottom-0 left-0 right-0 bg-orange-500/95 backdrop-blur-sm text-white p-4 z-10">
      <div className="flex justify-center items-center">
        <span className="text-xs sm:text-sm font-medium">Copyright © 2025 | Jolo Gracilla</span>
      </div>
    </div>
  </div>
  </div>
  )
}
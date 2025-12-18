"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { Bell, BellOff, LogOut, CheckCircle, MapPin, Send, Map, FileText, Calendar as CalendarIcon, FireExtinguisher, HeartPulse, Car, CloudRain, Swords, HelpCircle, PersonStanding, Navigation, Clock } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import AdminRealtimeOverlay, { AdminRealtimeOverlayRef, AdminNotificationRow } from "@/components/admin/AdminRealtimeOverlay"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, isSameDay } from "date-fns"
import { cn } from "@/lib/utils"
import React from "react"
import { useRouter } from "next/navigation"

const LocationMap = dynamic(
  () => import('@/components/LocationMap'),
  { ssr: false }
);


interface Notification {
  id: string;
  emergency_report_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  type: 'new_report' | 'report_update';
  reporterFirstName?: string;
  reporterLastName?: string;
  reporterMobileNumber?: string;
  reportLatitude?: number;
  reportLongitude?: number;
  reportLocationAddress?: string;
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

interface InternalReport {
  id: number;
  original_report_id: string | null;
  incident_type_id: number;
  incident_date: string; 
  time_responded: string | null;
  barangay_id: number;
  er_team_id: number;
  persons_involved: number | null;
  number_of_responders: number | null;
  prepared_by: string;
  created_at: string; 
}

interface BaseEntry {
  id: number;
  name: string;
}

type NotificationPermissionState = NotificationPermission | "unsupported";

interface ErTeamReportSummary {
  id: string
  status: "draft" | "pending_review" | "in_review" | "approved" | "rejected"
  er_team_id: number
  submitted_by: string
  patient_payload: Record<string, any>[] // Now an array of patients
  incident_payload: Record<string, any> | null
  injury_payload: {
    front?: Record<string, string[]>
    back?: Record<string, string[]>
  } | null
  notes: string | null
  created_at: string
  updated_at: string
  emergency_report_id: string | null
  emergency_report?: {
    id: string
    status: string
    emergency_type: string | null
    location_address: string | null
    created_at: string
    responded_at: string | null
    resolved_at: string | null
    er_team_id: number | null
  } | null
  internal_report_id: number | null
  internal_report?: {
    id: number
    incident_date: string
    time_responded: string | null
    barangay_id: number | null
    er_team_id: number | null
    prepared_by: string | null
  } | null
}

interface AdminDashboardProps {
  onLogout: () => void;
  userData: any;
}

export function AdminDashboard({ onLogout, userData }: AdminDashboardProps) {
  const [adminUser, setAdminUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [allReports, setAllReports] = useState<Report[]>([]);
  const [internalReports, setInternalReports] = useState<InternalReport[]>([]);
  const [erTeams, setErTeams] = useState<BaseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'ok' | 'degraded' | 'offline'>('ok');
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isLoadingAction, setIsLoadingAction] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>(''); 
  const [barangay, setBarangay] = useState<string>('');
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [pendingBroadcastType, setPendingBroadcastType] = useState<'earthquake' | 'tsunami' | null>(null);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastValidationError, setBroadcastValidationError] = useState<string | null>(null);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [erTeamReports, setErTeamReports] = useState<ErTeamReportSummary[]>([])
  const [erTeamReportsLoading, setErTeamReportsLoading] = useState(false)
  const [erTeamReportsError, setErTeamReportsError] = useState<string | null>(null)
  const [erTeamReportsActionLoading, setErTeamReportsActionLoading] = useState(false)

  const selectedErTeamReport = useMemo(() => {
    if (!selectedReport) return null
    return erTeamReports.find((report) => report.emergency_report_id === selectedReport.id) ?? null
  }, [erTeamReports, selectedReport])
  const overlayRef = useRef<AdminRealtimeOverlayRef>(null)
  const notificationsDropdownRef = useRef<HTMLDivElement>(null);
  const notificationsButtonRef = useRef<HTMLButtonElement>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('mdrrmo_admin_sound_enabled');
      if (stored === null) {
        localStorage.setItem('mdrrmo_admin_sound_enabled', 'true');
        return true;
      }
      return stored !== 'false';
    }
    return true;
  });
  const [activeAlertPath, setActiveAlertPath] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasAutoSelectedRef = useRef<boolean>(false);
  const [isPageVisible, setIsPageVisible] = useState<boolean>(true);
  const isPageVisibleRef = useRef<boolean>(true);
  const [browserNotificationPermission, setBrowserNotificationPermission] = useState<NotificationPermissionState>('default');

  const loadActiveAlert = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('alert_settings')
        .select('active_file_path')
        .order('updated_at', { ascending: false })
        .limit(1);
      if (!error && data && data.length > 0) {
        setActiveAlertPath(data[0].active_file_path);
      } else {
        setActiveAlertPath(null);
      }
    } catch (e) {
      console.warn('Failed to load alert settings (fallback to default sound).', e);
      setActiveAlertPath(null);
    }
  }, []);

  const playAlertSound = useCallback(async () => {
    try {
      if (!soundEnabled) return;
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      let url: string | null = null;
      if (activeAlertPath) {
        const { data, error } = await supabase
          .storage
          .from('alert_sounds')
          .createSignedUrl(activeAlertPath, 60);
        if (!error && data?.signedUrl) {
          url = data.signedUrl;
        } else {
          console.warn('[AdminAlertSound] Signed URL unavailable for active alert path', activeAlertPath);
        }
      }
      if (!url) {
        console.log('[AdminAlertSound] Using fallback sound /sounds/alert.mp3');
        url = "/sounds/alert.mp3";
      }
      audioRef.current.src = url;
      audioRef.current.volume = 1.0;
      await audioRef.current.play().catch(err => {
        console.warn('Autoplay may be blocked by the browser:', err);
      });
    } catch (e) {
      console.error('Error playing alert sound:', e);
    }
  }, [soundEnabled, activeAlertPath]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("mdrrmo_admin_sound_enabled", String(next));
      }
      return next;
    });

    setTimeout(() => {
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      if (soundEnabled === false && activeAlertPath) {
        void playAlertSound();
      }
    }, 100);
  }, [soundEnabled, activeAlertPath, playAlertSound]);

  const requestBrowserNotificationPermission = useCallback(async (): Promise<NotificationPermissionState> => {
    if (typeof window === 'undefined') {
      return 'default';
    }
    if (!('Notification' in window)) {
      setBrowserNotificationPermission('unsupported');
      return 'unsupported';
    }
    let permission = window.Notification.permission as NotificationPermissionState;
    setBrowserNotificationPermission(permission);
    if (permission === 'default') {
      try {
        permission = await window.Notification.requestPermission();
        setBrowserNotificationPermission(permission);
      } catch (error) {
        console.warn('[AdminDashboard] Notification permission request failed', error);
      }
    }
    return permission;
  }, []);

  type SystemNotificationPayload = Pick<Notification, 'id' | 'message' | 'emergency_report_id' | 'type'>;

  const showSystemNotification = useCallback(async (record: SystemNotificationPayload): Promise<void> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }
    let permission = window.Notification.permission as NotificationPermissionState;
    if (permission === 'default') {
      permission = await requestBrowserNotificationPermission();
    }
    if (permission !== 'granted') {
      return;
    }
    try {
      const NotificationConstructor = window.Notification;
      const notificationInstance = new NotificationConstructor('Emergency Alert', {
        body: record.message || 'New emergency update received.',
        tag: record.id,
        requireInteraction: true,
        icon: '/images/logo.png',
        badge: '/images/logo.png',
        data: {
          reportId: record.emergency_report_id,
          type: record.type,
        },
      });

      notificationInstance.onclick = () => {
        if (typeof window !== 'undefined') {
          window.focus?.();
        }
        notificationInstance.close?.();
      };
    } catch (error) {
      console.warn('[AdminDashboard] Failed to show system notification', error);
    }
  }, [requestBrowserNotificationPermission]);

  useEffect(() => {
    void requestBrowserNotificationPermission();
  }, [requestBrowserNotificationPermission]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsPageVisible(visible);
      isPageVisibleRef.current = visible;
    };

    handleVisibilityChange();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    let handleFocus: (() => void) | undefined;
    let handleBlur: (() => void) | undefined;

    if (typeof window !== 'undefined') {
      handleFocus = () => {
        setIsPageVisible(true);
        isPageVisibleRef.current = true;
      };
      handleBlur = () => {
        const visible = !document.hidden;
        setIsPageVisible(visible);
        isPageVisibleRef.current = visible;
      };
      window.addEventListener('focus', handleFocus);
      window.addEventListener('blur', handleBlur);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (typeof window !== 'undefined') {
        if (handleFocus) window.removeEventListener('focus', handleFocus);
        if (handleBlur) window.removeEventListener('blur', handleBlur);
      }
    };
  }, []);

  useEffect(() => {
    isPageVisibleRef.current = isPageVisible;
  }, [isPageVisible]);

  useEffect(() => {
    if (hasAutoSelectedRef.current) return;
    if (selectedReport) return;
    if (!allReports || allReports.length === 0) return;
    const prioritized = allReports.find(r => {
      const s = (r.status || '').trim().toLowerCase();
      return s === 'pending' || s === 'active';
    }) || allReports[0];

    setSelectedReport(prioritized);
    hasAutoSelectedRef.current = true;

    if (!selectedTeamId && erTeams.length > 0) {
      setSelectedTeamId(String(erTeams[0].id));
    }
  }, [allReports, selectedReport, erTeams, selectedTeamId]);
  const [resolvedFilterDate, setResolvedFilterDate] = useState<Date | undefined>(new Date());
  const [showActiveModal, setShowActiveModal] = useState(false);
  const [showRespondedModal, setShowRespondedModal] = useState(false);
  const [hasCustomResolvedDate, setHasCustomResolvedDate] = useState<boolean>(false);

  useEffect(() => {
    if (userData) {
      setAdminUser(userData);
      setLoading(false);
    } else {
      const storedUser = localStorage.getItem("mdrrmo_user");
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setAdminUser(parsedUser);
        } catch (parseError) {
          console.error("Error parsing stored user data:", parseError);
          setError("Corrupted user data in local storage. Please log in again.");
          localStorage.removeItem("mdrrmo_user");
        }
      } else {
        setError("Admin not logged in. Please log in as an administrator.");
      }
      setLoading(false);
    }
  }, [userData]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showNotificationsDropdown &&
        notificationsDropdownRef.current &&
        !notificationsDropdownRef.current.contains(event.target as Node) &&
        notificationsButtonRef.current &&
        !notificationsButtonRef.current.contains(event.target as Node)
      ) {
        setShowNotificationsDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotificationsDropdown]);

  const fetchAdminNotifications = useCallback(async () => {
    const { data, error } = await supabase
      .from('admin_notifications')
      .select(`
        *,
        emergency_report:emergency_report_id (
          id,
          firstName,
          lastName,
          mobileNumber,
          latitude,
          longitude,
          location_address,
          emergency_type,
          status,
          reportedAt,
          created_at,
          responded_at,
          resolved_at,
          user_id
        )
      `)
      .eq('type', 'new_report')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching admin notifications:", error);
      if (String(error?.message || '').toLowerCase().includes('failed to fetch')) {
        setConnectionStatus('degraded');
      }
      return [];
    }
    
    setConnectionStatus('ok');

    const fetchedNotifications: Notification[] = data.map((item: any) => ({
      id: item.id,
      emergency_report_id: item.emergency_report_id,
      message: item.emergency_report ?
        `🚨 NEW EMERGENCY: ${item.emergency_report.firstName} ${item.emergency_report.lastName} at ${item.emergency_report.location_address || 'Unknown Location'}` :
        item.message,
      is_read: item.is_read,
      created_at: item.created_at,
      type: item.type,
      reporterFirstName: item.emergency_report?.firstName,
      reporterLastName: item.emergency_report?.lastName,
      reporterMobileNumber: item.emergency_report?.mobileNumber,
      reportLatitude: item.emergency_report?.latitude,
      reportLongitude: item.emergency_report?.longitude,
      reportLocationAddress: item.emergency_report?.location_address,
    }));

    return fetchedNotifications;
  }, []);

  const fetchAllReports = useCallback(async () => {
    const { data, error } = await supabase
      .from('emergency_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching reports:", error);
      if (String(error?.message || '').toLowerCase().includes('failed to fetch')) {
        setConnectionStatus('degraded');
      }
      return [];
    }
    setConnectionStatus('ok');
    return data || [];
  }, []);

  const fetchInternalReports = useCallback(async () => {
    const { data, error } = await supabase
      .from('internal_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching internal reports:", error);
      if (String(error?.message || '').toLowerCase().includes('failed to fetch')) {
        setConnectionStatus('degraded');
      }
      return [];
    }
    setConnectionStatus('ok');
    return data || [];
  }, []);

  const fetchErTeams = useCallback(async () => {
    const { data, error } = await supabase
      .from('er_teams')
      .select('id, name')
      .order('name', { ascending: true });
    if (error) {
      console.error("Error fetching ER Teams:", error);
      if (String(error?.message || '').toLowerCase().includes('failed to fetch')) {
        setConnectionStatus('degraded');
      }
      return [];
    }
    setConnectionStatus('ok');
    return data as BaseEntry[] || [];
  }, []);

  const fetchSingleReport = useCallback(async (reportId: string) => {
    const { data, error } = await supabase
      .from('emergency_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (error) {
      console.error("Error fetching single report:", error);
      return null;
    }
    return data;
  }, []);

  const fetchSingleNotification = useCallback(async (notificationId: string) => {
    const { data, error } = await supabase
      .from('admin_notifications')
      .select(`
        *,
        emergency_report:emergency_report_id (
          id,
          firstName,
          lastName,
          mobileNumber,
          latitude,
          longitude,
          location_address,
          emergency_type,
          status,
          reportedAt,
          created_at,
          responded_at,
          resolved_at,
          user_id
        )
      `)
      .eq('id', notificationId)
      .single();

    if (error) {
      console.error("Error fetching single notification:", error);
      return null;
    }

    const fetchedNotification: Notification = {
      id: data.id,
      emergency_report_id: data.emergency_report_id,
      message: data.emergency_report ?
        `🚨 NEW EMERGENCY: ${data.emergency_report.firstName} ${data.emergency_report.lastName} at ${data.emergency_report.location_address || 'Unknown Location'}` :
        data.message,
      is_read: data.is_read,
      created_at: data.created_at,
      type: data.type,
      reporterFirstName: data.emergency_report?.firstName,
      reporterLastName: data.emergency_report?.lastName,
      reporterMobileNumber: data.emergency_report?.mobileNumber,
      reportLatitude: data.emergency_report?.latitude,
      reportLongitude: data.emergency_report?.longitude,
      reportLocationAddress: data.emergency_report?.location_address,
    };

    return fetchedNotification;
  }, []);

  const dedupeNearbyReports = useCallback(async (base: Report) => {
    try {
      const baseLat = (base as any).latitude as number | undefined;
      const baseLon = (base as any).longitude as number | undefined;
      const baseAddr = ((base as any).location_address || '').toString().trim().toLowerCase();
      console.log(`Dedupe base: lat ${baseLat}, lon ${baseLon}, addr "${baseAddr}", type ${base.emergency_type}, time ${base.created_at}`);
      if (typeof baseLat !== 'number' || typeof baseLon !== 'number') {
        console.log('Dedup skipped: base report missing coordinates');
        return;
      }

      const baseTime = new Date(base.created_at).getTime();
      const startWindow = new Date(baseTime - 30 * 60 * 1000).toISOString();
      const endWindow = new Date(baseTime + 30 * 60 * 1000).toISOString();

      const { data: candidates, error } = await supabase
        .from('emergency_reports')
        .select('id, user_id, firstName, lastName, mobileNumber, latitude, longitude, location_address, emergency_type')
        .neq('id', base.id)
        .in('status', ['pending', 'active'])
        .eq('emergency_type', base.emergency_type)
        .gte('created_at', startWindow)
        .lte('created_at', endWindow);

      if (error) {
        console.error('Error querying duplicates:', error);
        return;
      }
      if (!candidates || candidates.length === 0) {
        console.log('No candidates found for dedupe');
        return;
      }
      console.log(`Found ${candidates.length} candidate reports for dedupe`);

      const toRad = (v: number) => (v * Math.PI) / 180;
      const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371000;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };
      const RADIUS_METERS = 50;

      const duplicates = candidates.filter((r: any) => {
        const candLat = r.latitude as number | undefined;
        const candLon = r.longitude as number | undefined;
        const candAddr = (r.location_address || '').toString().trim().toLowerCase();

        let closeBy = false;
        if (
          typeof candLat === 'number' && typeof candLon === 'number'
        ) {
          try {
            const dist = haversineMeters(baseLat, baseLon, candLat, candLon);
            closeBy = dist <= RADIUS_METERS;
          } catch (_) {
            closeBy = false;
          }
        }
        const sameAddress = baseAddr && candAddr && baseAddr === candAddr;
        return closeBy || sameAddress;
      });

      if (duplicates.length === 0) {
        console.log('No duplicates found');
        return;
      }
      console.log(`Found ${duplicates.length} duplicates to delete`);

      const selectedTeam = erTeams.find(team => team.id === parseInt(selectedTeamId || ''));
      const teamName = selectedTeam ? selectedTeam.name : 'a response team';

      for (const dup of duplicates) {
        const { error: notificationError } = await supabase
          .from('user_notifications')
          .insert({
            user_id: dup.user_id,
            emergency_report_id: dup.id,
            message: `Your emergency report for ${dup.emergency_type} is OTW. Team ${teamName} is responding.`
          });

        if (notificationError) {
          console.error('Error sending notification to duplicate user:', notificationError);
        }

        const reporterNameParts = [dup.firstName, dup.lastName].filter(Boolean);
        const reporterName = reporterNameParts.length > 0 ? reporterNameParts.join(' ') : 'Citizen';
        const locationSummary = (dup.location_address || '').trim() || 'your reported location';
        const smsMessage = `Hello ${reporterName}, Team ${teamName} is now responding to your ${dup.emergency_type} report at ${locationSummary}. Please stay safe.`;

        void fetch('/api/alerts/send-sms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reportId: dup.id,
            message: smsMessage,
          }),
        }).then(async (res) => {
          if (!res.ok) {
            const payload = await res.json().catch(() => null);
            console.warn('Failed to send SMS to duplicate user', payload);
          }
        }).catch((err) => {
          console.error('Semaphore SMS request error for duplicate', err);
        });
      }

      const duplicatesToDelete = duplicates.map((r: any) => r.id);

      const { error: notifDelErr } = await supabase
        .from('admin_notifications')
        .delete()
        .in('emergency_report_id', duplicatesToDelete);
      if (notifDelErr) {
        console.warn('Error deleting related admin notifications for duplicates:', notifDelErr);
      }

      const { error: dupDeleteError } = await supabase
        .from('emergency_reports')
        .delete()
        .in('id', duplicatesToDelete);
      if (dupDeleteError) {
        console.error('Error deleting duplicate reports:', dupDeleteError);
      } else {
        console.log(`Deleted ${duplicatesToDelete.length} duplicate report(s) within 50m and ±30min.`);
      }

      const refreshed = await fetchAllReports();
      setAllReports(refreshed.map((item: any) => ({ ...item })));
    } catch (e) {
      console.error('Unexpected error during dedupe:', e);
    }
  }, [fetchAllReports, erTeams, selectedTeamId]);

  const handleLogout = async () => {
    try {
      await onLogout();
    } finally {
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  };

  const router = useRouter()

  const erTeamReportsFetchingRef = useRef(false)
  const erTeamReportsLastFetchedRef = useRef(0)

  const fetchErTeamReports = useCallback(
    async (force = false) => {
      if (erTeamReportsFetchingRef.current) return
      const now = Date.now()
      if (!force && now - erTeamReportsLastFetchedRef.current < 4000) {
        return
      }

      erTeamReportsFetchingRef.current = true
      setErTeamReportsLoading(true)
      setErTeamReportsError(null)
      try {
        const response = await fetch("/api/admin/er-team-reports?status=pending_review,in_review", {
          credentials: "include",
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload?.error ?? response.statusText)
        }
        const payload = (await response.json()) as { reports: ErTeamReportSummary[] }
        setErTeamReports(payload.reports ?? [])
      } catch (err: any) {
        const message = err?.message ?? "Failed to load ER team reports"
        if (String(message).toLowerCase().includes("too many requests")) {
          setErTeamReportsError("Temporarily rate limited. Please try again in a moment.")
        } else {
          setErTeamReportsError(message)
        }
        console.error("Failed to load ER team reports", err)
      } finally {
        erTeamReportsFetchingRef.current = false
        erTeamReportsLastFetchedRef.current = Date.now()
        setErTeamReportsLoading(false)
      }
    },
    []
  )

  const handleErTeamReportAction = useCallback(
    async (action: "in_review" | "approve") => {
      if (!selectedErTeamReport) return
      try {
        setErTeamReportsActionLoading(true)
        setErTeamReportsError(null)
        const response = await fetch("/api/admin/er-team-reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ reportId: selectedErTeamReport.id, action }),
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload?.error ?? response.statusText)
        }
        await fetchErTeamReports(true)
      } catch (err: any) {
        console.error("Failed to update ER team report status", err)
        setErTeamReportsError(err?.message ?? "Failed to update ER team report status")
      } finally {
        setErTeamReportsActionLoading(false)
      }
    },
    [fetchErTeamReports, selectedErTeamReport]
  )

  useEffect(() => {
    const fetchAllDashboardData = async () => {
      try {
        const [reportsData, notificationsData, internalReportsData, erTeamsData] = await Promise.all([
          fetchAllReports(),
          fetchAdminNotifications(),
          fetchInternalReports(),
          fetchErTeams(),
        ]);

        setAllReports(reportsData.map((item: any) => ({ ...item })));
        setInternalReports(internalReportsData.map((item: any) => ({ ...item })));
        setErTeams(erTeamsData);

        if (erTeamsData.length > 0 && !selectedTeamId) {
          setSelectedTeamId(String(erTeamsData[0].id));
        }

        setNotifications(notificationsData);
        setUnreadCount(notificationsData.filter(n => !n.is_read).length);

      } catch (err: any) {
        console.error("Error fetching dashboard data:", err);
        setConnectionStatus('degraded');
      }
    };

    fetchAllDashboardData();
    loadActiveAlert();
    void fetchErTeamReports(true);

    // Auth state change listener to handle token refresh
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session ? 'session exists' : 'no session');
      
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        console.log('Auth refreshed, re-establishing real-time channels');
        // Re-establish channels after auth refresh
        setTimeout(() => {
          fetchAllDashboardData();
        }, 100);
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out, cleaning up channels');
        setConnectionStatus('offline');
      }
    });

    const reportsChannel = supabase
      .channel('emergency-reports-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'emergency_reports' },
        async (payload) => {
          console.log('Change received on emergency_reports:', payload);
          
          if (payload.eventType === 'INSERT' && payload.new) {
            // Add new report to the list
            const newReport = payload.new as Report;
            setAllReports(prev => {
              const exists = prev.some(r => r.id === newReport.id);
              if (!exists) {
                return [newReport, ...prev];
              }
              return prev;
            });
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            // Update existing report
            const updatedReport = payload.new as Report;
            setAllReports(prev => prev.map(r => r.id === updatedReport.id ? updatedReport : r));
          } else if (payload.eventType === 'DELETE' && payload.old) {
            // Remove deleted report
            const deletedId = payload.old.id;
            setAllReports(prev => prev.filter(r => r.id !== deletedId));
          }
        }
      )
      .subscribe((status) => {
        console.log('Emergency reports channel status:', status);
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('ok');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Emergency reports channel error, attempting to reconnect');
          setConnectionStatus('degraded');
          // Attempt to reconnect after a delay
          setTimeout(() => {
            fetchAllReports().then(reports => setAllReports(reports));
          }, 5000);
        }
      });

    const adminNotificationsChannel = supabase
      .channel('admin-notifications-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'admin_notifications' },
        async (payload) => {
          console.log('Change received on admin_notifications:', payload);
          
          if (payload.eventType === 'INSERT' && payload.new) {
            const newNotification = payload.new;
            // Fetch the full notification with emergency report data
            const fullNotification = await fetchSingleNotification(newNotification.id);
            if (fullNotification) {
              setNotifications(prev => [fullNotification, ...prev]);
              setUnreadCount(prev => prev + (fullNotification.is_read ? 0 : 1));
              
              try {
                if (newNotification.type === 'new_report') {
                  playAlertSound();
                  if (overlayRef.current) {
                    console.log('Triggering overlay for new report:', newNotification);
                    overlayRef.current.showNotificationOverlay(newNotification as AdminNotificationRow);
                  }
                  if (!isPageVisibleRef.current) {
                    void showSystemNotification({
                      id: fullNotification.id,
                      emergency_report_id: fullNotification.emergency_report_id,
                      message: fullNotification.message,
                      type: fullNotification.type,
                    });
                  }
                }
              } catch (e) {
                console.warn('Failed to process notification payload for sound:', e);
              }
            }
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedNotification = payload.new;
            setNotifications(prev => prev.map(n => 
              n.id === updatedNotification.id 
                ? { ...n, is_read: updatedNotification.is_read }
                : n
            ));
            // Recalculate unread count
            setNotifications(current => {
              setUnreadCount(current.filter(n => !n.is_read).length);
              return current;
            });
          } else if (payload.eventType === 'DELETE' && payload.old) {
            const deletedId = payload.old.id;
            setNotifications(prev => {
              const wasUnread = prev.find(n => n.id === deletedId)?.is_read === false;
              const filtered = prev.filter(n => n.id !== deletedId);
              if (wasUnread) {
                setUnreadCount(count => Math.max(0, count - 1));
              }
              return filtered;
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('Admin notifications channel status:', status);
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('ok');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Admin notifications channel error, attempting to reconnect');
          setConnectionStatus('degraded');
          // Attempt to reconnect after a delay
          setTimeout(() => {
            fetchAdminNotifications().then(notifications => {
              setNotifications(notifications);
              setUnreadCount(notifications.filter(n => !n.is_read).length);
            });
          }, 5000);
        }
      });

    const alertSettingsChannel = supabase
      .channel('dashboard-alert-settings-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alert_settings' },
        () => {
          console.log('Alert settings changed, reloading active alert path');
          loadActiveAlert();
        }
      )
      .subscribe((status) => {
        console.log('Alert settings channel status:', status);
      });

    const internalReportsChannel = supabase
      .channel('dashboard-internal-reports-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'internal_reports' },
        (payload) => {
          console.log('Change received on internal_reports, refetching internal reports:', payload);
          console.log('Selected Report ID:', selectedReport?.id);
          console.log('Internal Reports (original_report_id):', internalReports.map(ir => ir.original_report_id));
          fetchInternalReports().then(setInternalReports);
        }
      )
      .subscribe((status) => {
        console.log('Internal reports channel status:', status);
      });

    const erTeamsChannel = supabase
      .channel('dashboard-er-teams-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'er_teams' },
        (payload) => {
          console.log('Change received on er_teams, refetching ER teams:', payload);
          fetchErTeams().then(setErTeams);
        }
      )
      .subscribe((status) => {
        console.log('ER teams channel status:', status);
      });

    const erTeamReportsChannel = supabase
      .channel('dashboard-er-team-reports-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'er_team_reports' },
        (payload) => {
          console.log('Change received on er_team_reports, refetching ER team reports:', payload);
          void fetchErTeamReports();
        }
      )
      .subscribe((status) => {
        console.log('ER team reports channel status:', status);
      });


    return () => {
      supabase.removeChannel(reportsChannel);
      supabase.removeChannel(adminNotificationsChannel);
      supabase.removeChannel(internalReportsChannel);
      supabase.removeChannel(erTeamsChannel);
      supabase.removeChannel(alertSettingsChannel);
      supabase.removeChannel(erTeamReportsChannel);
      authSubscription.unsubscribe();
    };
  }, [fetchAllReports, fetchAdminNotifications, fetchInternalReports, fetchErTeams, selectedReport, internalReports, loadActiveAlert, playAlertSound, fetchErTeamReports, fetchSingleReport, fetchSingleNotification]);

  useEffect(() => {
    if (selectedReport?.latitude && selectedReport?.longitude) {
      setBarangay('Fetching...');
      fetch(`/api/geocode?lat=${selectedReport.latitude}&lon=${selectedReport.longitude}`)
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to fetch location data');
          }
          return response.json();
        })
        .then(data => {
          console.log('Reverse Geocoding API Response:', data);
          const address = data.address;
          const barangayName = address?.village || address?.suburb || address?.neighbourhood || address?.quarter || address?.city_district || 'N/A';
          setBarangay(barangayName);
        })
        .catch(error => {
          console.error('Error fetching barangay:', error);
          setBarangay('Unavailable');
        });
    }
  }, [selectedReport]);

  const triggerBroadcastAlert = useCallback((type: 'earthquake' | 'tsunami') => {
    setPendingBroadcastType(type)
    setBroadcastMessage('')
    setBroadcastValidationError(null)
    setBroadcastModalOpen(true)
  }, [])

  const confirmBroadcastAlert = useCallback(async () => {
    if (!pendingBroadcastType) return
    const label = pendingBroadcastType === 'earthquake' ? 'EARTHQUAKE ALERT' : 'TSUNAMI ALERT'
    const typeToSend = pendingBroadcastType
    const trimmed = broadcastMessage.trim()
    if (!trimmed) {
      setBroadcastValidationError('Message is required.')
      return
    }
    setBroadcastValidationError(null)
    setIsLoadingAction(true)
    setError(null)
    try {
      const res = await fetch('/api/broadcast-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: typeToSend, title: label, body: trimmed })
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || `Failed to send ${label}`)
      }
      setBroadcastModalOpen(false)
      setPendingBroadcastType(null)
      setBroadcastMessage('')
    } catch (e: any) {
      console.error('Broadcast error:', e)
      setError(e?.message || 'Broadcast failed')
    } finally {
      setIsLoadingAction(false)
    }
  }, [pendingBroadcastType, broadcastMessage])

  const handleBroadcastModalChange = useCallback((open: boolean) => {
    setBroadcastModalOpen(open)
    if (!open) {
      setPendingBroadcastType(null)
      setBroadcastMessage('')
      setBroadcastValidationError(null)
    }
  }, [])

  const markAllNotificationsAsRead = useCallback(async () => {
    if (unreadCount === 0) return;
    
    const unreadNotifications = notifications.filter(n => !n.is_read);
    const unreadIds = unreadNotifications.map(n => n.id);
    
    if (unreadIds.length === 0) return;

    console.log(`Attempting to mark ${unreadIds.length} notifications as read`);
    setIsLoadingAction(true);
    setError(null);
    
    try {
      setNotifications(prev => 
        prev.map(n => ({
          ...n,
          is_read: true
        }))
      );
      setUnreadCount(0);
      
      console.log('Updating notifications in database...');
      
      const { data, error } = await supabase
        .from('admin_notifications')
        .update({ is_read: true })
        .in('id', unreadIds)
        .select(); 
        
      if (error) {
        console.error('Batch update failed, trying one by one:', error);
        
        for (const id of unreadIds) {
          const { error: singleError } = await supabase
            .from('admin_notifications')
            .update({ is_read: true })
            .eq('id', id);
            
          if (singleError) {
            console.error(`Failed to update notification ${id}:`, singleError);
          }
        }
      } else {
        console.log('Successfully updated notifications:', data);
      }
      
      const refreshedNotifications = await fetchAdminNotifications();
      setNotifications(refreshedNotifications);
      setUnreadCount(refreshedNotifications.filter(n => !n.is_read).length);
      
    } catch (error) {
      console.error("Error in markAllNotificationsAsRead:", error);
      setError("Failed to mark all notifications as read. Please try again.");
      
      const refreshedNotifications = await fetchAdminNotifications();
      setNotifications(refreshedNotifications);
      setUnreadCount(refreshedNotifications.filter(n => !n.is_read).length);
    } finally {
      setIsLoadingAction(false);
    }
  }, [notifications, unreadCount]);

  const handleReportClick = useCallback((report: Report) => {
    setSelectedReport(report);
    if (!selectedReport || selectedReport.id !== report.id) {
      if (erTeams.length > 0) {
        setSelectedTeamId(String(erTeams[0].id));
      } else {
        setSelectedTeamId('');
      }
    }
  }, [erTeams, selectedReport]);

  const handleNotificationClick = useCallback(async (notification: Notification) => {
    if (!notification.is_read) {
      const { error } = await supabase.from('admin_notifications').update({ is_read: true }).eq('id', notification.id);
      if (error) {
        console.error('Error marking notification as read:', error);
      } else {
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    }
    if (notification.emergency_report_id) {
      const report = allReports.find(r => r.id === notification.emergency_report_id);
      if (report) {
        handleReportClick(report);
      }
    }
    setShowNotificationsDropdown(false);
  }, [allReports]);

  const handleRespondToIncident = useCallback(async () => {
    if (!selectedReport || !selectedTeamId) {
      setError('Please select a team before responding.');
      return;
    }
    
    setIsLoadingAction(true);
    setError(null);
    
    try {
      const selectedTeamObj = erTeams.find(team => team.id === parseInt(selectedTeamId));
      if (!selectedTeamObj) {
        throw new Error('Selected team not found');
      }
      
      const responseMessage = `Team ${selectedTeamObj.name} is responding.`;
      const updateData = { 
        status: 'responded', 
        admin_response: responseMessage, 
        responded_at: new Date().toISOString(),
        er_team_id: selectedTeamObj.id 
      };
      
      const { data: updatedReport, error: updateError } = await supabase
        .from('emergency_reports')
        .update(updateData)
        .eq('id', selectedReport.id)
        .select()
        .single();
        
      if (updateError) throw updateError;

      const selectedTeam = erTeams.find(team => team.id === parseInt(selectedTeamId));
      const teamName = selectedTeam ? selectedTeam.name : 'a response team';
      
      const { error: notificationError } = await supabase
        .from('user_notifications')
        .insert({ 
          user_id: selectedReport.user_id, 
          emergency_report_id: selectedReport.id, 
          message: `Your emergency report for ${selectedReport.emergency_type} is OTW. Team ${teamName} is responding.` 
        });
        
      if (notificationError) {
        console.error('Error sending user notification:', notificationError);
      }

      const reporterNameParts = [selectedReport.firstName, selectedReport.lastName].filter(Boolean);
      const reporterName = reporterNameParts.length > 0 ? reporterNameParts.join(' ') : 'Citizen';
      const locationSummary = (selectedReport.location_address || '').trim() || 'your reported location';
      const smsMessage = `Hello ${reporterName}, Team ${teamName} is now responding to your ${selectedReport.emergency_type} report at ${locationSummary}. Please stay safe.`;

      void fetch('/api/alerts/send-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId: selectedReport.id,
          message: smsMessage,
        }),
      }).then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          console.warn('Failed to send SMS notification', payload);
        }
      }).catch((err) => {
        console.error('Semaphore SMS request error', err);
      });

      await dedupeNearbyReports(updatedReport as Report);

      await fetchAllReports();
      setSelectedReport(updatedReport as Report);
      
    } catch (err: any) {
      setError(`Failed to respond: ${err.message}. Check RLS policies.`);
      console.error('Error in handleRespondToIncident:', err);
    } finally {
      setIsLoadingAction(false);
    }
  }, [selectedReport, selectedTeamId, erTeams, fetchAllReports]);

  const handleRescueDone = useCallback(async () => {
    if (!selectedReport) return;
    setIsLoadingAction(true);
    setError(null);
    try {
      const nowIso = new Date().toISOString();
      const { data: updatedReport, error: updateError } = await supabase
        .from('emergency_reports')
        .update({ status: 'resolved', resolved_at: nowIso })
        .eq('id', selectedReport.id)
        .select()
        .single();
      if (updateError) throw updateError;

      const { error: timeUpdateError } = await supabase
        .from('internal_reports')
        .update({ time_responded: nowIso })
        .eq('original_report_id', selectedReport.id);
      if (timeUpdateError) {
        console.error('Error updating time_responded on internal_reports:', timeUpdateError);
      }

      const { error: notificationError } = await supabase.from('user_notifications').insert({
        user_id: selectedReport.user_id,
        emergency_report_id: selectedReport.id,
        message: 'The Rescue Operation is successful. Thank you for reporting an incident! Take care always!',
      });
      if (notificationError) console.error('Error sending user notification:', notificationError);

      setSelectedReport(updatedReport as Report);
    } catch (err: any) {
      setError(`Failed to mark as resolved: ${err.message}. Check RLS policies.`);
    } finally {
      setIsLoadingAction(false);
    }
  }, [selectedReport]);

  const hasInternalReportBeenMade = React.useMemo(() => {
    if (!selectedReport?.id) return false;
    return internalReports.some(ir => ir.original_report_id === selectedReport.id);
  }, [selectedReport?.id, internalReports]);
  
  React.useEffect(() => {
    if (selectedReport?.id) {
      console.log(`hasInternalReportBeenMade for ${selectedReport.id}:`, hasInternalReportBeenMade);
    }
  }, [selectedReport?.id, hasInternalReportBeenMade]);

  
  const handleMakeReport = () => {
    if (selectedReport?.id) {
      window.open(`/admin/report?incidentId=${selectedReport.id}`, '_blank');
    } else {
      console.warn("No selected report to make a specific report for.");
    }
  };

  
  const totalReportsCount = allReports.length;
  const activeEmergenciesCount = allReports.filter(r => r.status.trim().toLowerCase() === 'active' || r.status.trim().toLowerCase() === 'pending').length;
  const respondedCount = allReports.filter(r => r.status.trim().toLowerCase() === 'responded').length;

  const filteredResolvedCount = React.useMemo(() => {
    if (!resolvedFilterDate) return 0;
    return allReports.filter(r =>
      r.status.trim().toLowerCase() === 'resolved' &&
      isSameDay(new Date(r.resolved_at || r.created_at), resolvedFilterDate) 
    ).length;
  }, [allReports, resolvedFilterDate]);


  
  const activeReportsList = allReports.filter(r => r.status.trim().toLowerCase() === 'active' || r.status.trim().toLowerCase() === 'pending');
  const respondedReportsList = allReports.filter(r => r.status.trim().toLowerCase() === 'responded');


  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };
  const [greeting, setGreeting] = useState<string>(getGreeting());
  useEffect(() => {
    const update = () => setGreeting(getGreeting());
    update();
    const interval = setInterval(update, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const phDateFormatter = React.useMemo(() => new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    month: 'long',
    day: '2-digit',
    year: 'numeric',
  }), []);
  const phTimeFormatter = React.useMemo(() => new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }), []);
  const [phDate, setPhDate] = useState<string>(phDateFormatter.format(new Date()));
  const [phTime, setPhTime] = useState<string>(phTimeFormatter.format(new Date()));
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setPhDate(phDateFormatter.format(now));
      setPhTime(phTimeFormatter.format(now));
    };
    const id = setInterval(tick, 1000);
    tick();
    return () => clearInterval(id);
  }, [phDateFormatter, phTimeFormatter]);

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen text-red-500 font-sans">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 font-sans text-gray-800">
      <AdminRealtimeOverlay ref={overlayRef} />
      <Dialog open={broadcastModalOpen} onOpenChange={handleBroadcastModalChange}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{pendingBroadcastType === 'earthquake' ? 'Earthquake Alert' : pendingBroadcastType === 'tsunami' ? 'Tsunami Alert' : 'Alert'} Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="broadcast-message">Message</Label>
              <Textarea
                id="broadcast-message"
                rows={5}
                value={broadcastMessage}
                onChange={event => setBroadcastMessage(event.target.value)}
                placeholder="Provide the alert details to be sent to all users."
                disabled={isLoadingAction}
              />
            </div>
            {broadcastValidationError && (
              <p className="text-sm text-red-600">{broadcastValidationError}</p>
            )}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => handleBroadcastModalChange(false)} disabled={isLoadingAction}>
              Cancel
            </Button>
            <Button onClick={confirmBroadcastAlert} disabled={isLoadingAction}>
              {isLoadingAction ? 'Sending…' : 'Send Alert'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <header className="flex items-center mb-8">
        <div className="flex items-center">
          <Sidebar/>
          <div className="ml-4">
            <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
            {adminUser && (
              <div className="text-sm sm:text-base font-medium text-gray-700 mt-1">
                {greeting}, {adminUser.firstName || adminUser.username || 'Admin'}
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center mx-2">
          <div className="mt-0 flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 shadow-sm">
            <Clock className="h-4 w-4 text-gray-600" />
            <span className="font-mono tabular-nums whitespace-nowrap text-lg sm:text-2xl md:text-3xl font-bold text-gray-900 leading-none">{phTime}</span>
          </div>
          <div className="mt-1 text-sm sm:text-base md:text-lg font-semibold text-gray-700">{phDate}</div>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4 ml-auto">
          <div className="hidden md:flex items-center gap-2 mr-2">
            <Button
              variant="destructive"
              onClick={() => triggerBroadcastAlert('tsunami')}
              disabled={isLoadingAction}
              title="Send Tsunami Alert to all users"
            >
              TSUNAMI ALERT
            </Button>
            <Button
              variant="default"
              onClick={() => triggerBroadcastAlert('earthquake')}
              disabled={isLoadingAction}
              title="Send Earthquake Alert to all users"
            >
              EARTHQUAKE ALERT
            </Button>
          </div>
          {connectionStatus !== 'ok' && (
            <span
              className={`hidden sm:inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${connectionStatus === 'offline' ? 'bg-red-100 text-red-800 border-red-300' : 'bg-yellow-100 text-yellow-800 border-yellow-300'}`}
              title={connectionStatus === 'offline' ? 'Offline: live updates paused' : 'Network degraded: updates may be delayed'}
            >
              {connectionStatus === 'offline' ? 'Offline' : 'Connection degraded'}
            </span>
          )}
          <div className="relative">
            <Button
              variant="outline"
              onClick={toggleSound}
              title={soundEnabled ? 'Disable alert sound' : 'Enable alert sound'}
              aria-label="Toggle alert sound"
            >
              {soundEnabled ? 'Sounds On' : 'Sounds Off'}
            </Button>
          </div>
          <div className="relative">
            <Button variant="ghost" size="icon" onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)} ref={notificationsButtonRef}>
              <Bell className="h-6 w-6" />
              {unreadCount > 0 && <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />}
            </Button>
            {showNotificationsDropdown && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl z-20" ref={notificationsDropdownRef}>
                <div className="p-4 font-bold border-b">Notifications</div>
                <ul className="max-h-96 overflow-y-auto">
                  {notifications.length > 0 ? notifications.map(n => (
                    <li key={n.id} onClick={() => handleNotificationClick(n)} className={`p-4 border-b hover:bg-gray-100 cursor-pointer ${!n.is_read ? 'font-semibold bg-blue-50' : ''}`}>
                      <p className="text-sm text-gray-700">{n.message}</p>
                      <p className="text-xs text-gray-500 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                    </li>
                  )) : <li className="p-4 text-center text-gray-500">No new notifications.</li>}
                </ul>
                {notifications.length > 0 && (
                  <div className="p-2 border-t">
                    <Button
                      variant="link"
                      className="w-full"
                      onClick={markAllNotificationsAsRead}
                      disabled={isLoadingAction || unreadCount === 0}
                    >
                      Mark all as read
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          <Button onClick={() => setShowLogoutConfirm(true)} variant="destructive"><LogOut className="mr-2 h-4 w-4" /> Logout</Button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="shadow cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setShowActiveModal(true)}>
              <CardHeader><CardTitle>Active Emergencies</CardTitle></CardHeader>
              <CardContent><p className="text-4xl font-bold text-red-600">{activeEmergenciesCount}</p></CardContent>
            </Card>
            <Card className="shadow cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setShowRespondedModal(true)}>
              <CardHeader><CardTitle>In-Progress</CardTitle></CardHeader>
              <CardContent><p className="text-4xl font-bold text-yellow-600">{respondedCount}</p></CardContent>
            </Card>
            <Card className="shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Resolved</CardTitle>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-[120px] justify-start text-left font-normal",
                        !resolvedFilterDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {resolvedFilterDate ? format(resolvedFilterDate, "MM/dd") : <span>Date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={resolvedFilterDate}
                      onSelect={(d) => {
                        const selected = d ?? new Date();
                        setResolvedFilterDate(selected);
                        setHasCustomResolvedDate(!isSameDay(selected, new Date()));
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold text-green-600">{filteredResolvedCount}</p>
                {!hasCustomResolvedDate && (
                  <p className="text-xs text-gray-500 mt-1">LATEST RESOLVED</p>
                )}
              </CardContent>
            </Card>
        </div>

        {/* The main dashboard content remains here, as it's the default view */}
        <>
            <div className="lg:col-span-2">
              <Card className="shadow-lg h-full">
                <CardHeader className="bg-orange-600 text-white"><CardTitle className="flex items-center"><MapPin className="mr-3" />Incident Details & Actions</CardTitle></CardHeader>
                <CardContent className="p-6">
                  {selectedReport ? (
                    <div>
                      <div className="flex items-center mb-4">
                        {selectedReport.emergency_type === 'Fire Incident' && <FireExtinguisher className="h-8 w-8 text-red-500 mr-3" />}
                        {selectedReport.emergency_type === 'Medical Emergency' && <HeartPulse className="h-8 w-8 text-red-500 mr-3" />}
                        {selectedReport.emergency_type === 'Vehicular Incident' && <Car className="h-8 w-8 text-blue-500 mr-3" />}
                        {selectedReport.emergency_type === 'Weather Disturbance' && <CloudRain className="h-8 w-8 text-blue-300 mr-3" />}
                        {selectedReport.emergency_type === 'Public Disturbance' && <PersonStanding className="h-8 w-8 text-orange-500 mr-3" />}
                        {selectedReport.emergency_type === 'Others' && <HelpCircle className="h-8 w-8 text-gray-500 mr-3" />}
                        <div>
                          <h3 className="text-2xl font-bold">{selectedReport.emergency_type}</h3>
                          <span className="text-sm text-gray-500">Reported Emergency Type</span>
                        </div>
                      </div>
                      <p className="text-gray-600 mb-4">Reported by: <span className="font-medium">{selectedReport.firstName} {selectedReport.lastName}</span></p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="md:col-span-2">
                          <p className="text-sm text-gray-500 mb-1">Location</p>
                          <div className="w-full max-w-md mx-auto rounded-lg overflow-hidden border border-gray-200">
                            <LocationMap 
                              latitude={selectedReport.latitude} 
                              longitude={selectedReport.longitude}
                              zoom={15}
                              className="w-full"
                            />
                            <div className="flex justify-center gap-3 p-2 bg-gray-50">
                              <a 
                                href={`https://www.openstreetmap.org/?mlat=${selectedReport.latitude}&mlon=${selectedReport.longitude}&zoom=15`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline flex items-center"
                              >
                                <MapPin className="h-3 w-3 mr-1" />
                                Open in OSM
                              </a>
                              <a 
                                href={`https://www.google.com/maps?q=${selectedReport.latitude},${selectedReport.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline flex items-center"
                              >
                                <MapPin className="h-3 w-3 mr-1" />
                                Open in Google Maps
                              </a>
                            </div>
                          </div>
                        </div>
                        <div><p className="text-sm text-gray-500">Barangay</p><p className="font-semibold">{barangay}</p></div>
                        <div><p className="text-sm text-gray-500">Contact</p><p className="font-semibold">{selectedReport.mobileNumber}</p></div>
                        <div><p className="text-sm text-gray-500">Reported At</p><p className="font-semibold">{new Date(selectedReport.created_at).toLocaleString()}</p></div>
                        <div><p className="text-sm text-gray-500">Status</p><p className={`font-bold ${selectedReport.status.trim().toLowerCase() === 'pending' || selectedReport.status.trim().toLowerCase() === 'active' ? 'text-red-600' : selectedReport.status.trim().toLowerCase() === 'responded' ? 'text-yellow-600' : 'text-green-600'}`}>{selectedReport.status}</p></div>
                        <div>
                          <p className="text-sm text-gray-500">Casualties</p>
                          <p className="font-semibold">{selectedReport.casualties ?? 0}</p>
                        </div>
                      </div>
                      <div className="p-4 border rounded-lg bg-gray-50 mb-6">
                        <h4 className="font-semibold mb-3">Incident Actions</h4>
                        {(selectedReport.status.trim().toLowerCase() === 'pending' || selectedReport.status.trim().toLowerCase() === 'active') && (
                          <div className="space-y-4">
                            <div>
                              <label htmlFor="team-select" className="block text-sm font-medium mb-1">Select response team:</label>
                             
                              <Select 
                                value={selectedTeamId} 
                                onValueChange={setSelectedTeamId}
                              >
                                <SelectTrigger className="w-full p-2 border border-gray-300 rounded-md shadow-sm">
                                  <SelectValue placeholder="Select ER team" />
                                </SelectTrigger>
                                <SelectContent className="bg-white rounded-md shadow-lg max-h-60 overflow-y-auto z-50">
                                  {erTeams.length > 0 ? (
                                    erTeams.map(team => (
                                      <SelectItem 
                                        key={team.id} 
                                        value={String(team.id)} 
                                        className="p-2 hover:bg-gray-100 cursor-pointer"
                                      >
                                        {team.name}
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <div className="p-2 text-center text-gray-500">No ER teams available.</div>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button onClick={handleRespondToIncident} disabled={isLoadingAction} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center"><Send size={18} className="mr-2" />{isLoadingAction ? 'Responding...' : 'Respond'}</Button>
                          </div>
                        )}
                        {selectedReport.status.trim().toLowerCase() === 'responded' && (
                            <Button onClick={handleRescueDone} disabled={isLoadingAction} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center"><CheckCircle size={18} className="mr-2" />{isLoadingAction ? 'Resolving...' : 'Rescue Done'}</Button>
                        )}
                        
                        {selectedReport.status.trim().toLowerCase() === 'resolved' && !hasInternalReportBeenMade && (
                          <Button
                            onClick={handleMakeReport}
                            disabled={isLoadingAction}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center mt-4"
                          >
                            <FileText size={18} className="mr-2" /> Make a Report
                          </Button>
                        )}
                        {selectedReport.status.trim().toLowerCase() === 'resolved' && hasInternalReportBeenMade && (
                          <p className="text-sm text-gray-500 text-center mt-4">
                            <CheckCircle className="inline-block h-4 w-4 mr-1 text-green-500" /> Internal report already created for this incident.
                          </p>
                        )}
                      </div>

                      {selectedErTeamReport ? (
                        <div className="mb-6 space-y-4 rounded-lg border border-orange-200 bg-orange-50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h4 className="text-sm font-semibold text-orange-900">ER Team PCR submission</h4>
                              <p className="text-xs text-orange-700/80">
                                Received {new Date(selectedErTeamReport.updated_at).toLocaleString()} · Status: {selectedErTeamReport.status.replace(/_/g, " ")}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-orange-300 text-orange-700 hover:bg-white"
                                onClick={() => router.push(`/admin/report?erTeamReportId=${selectedErTeamReport.id}`)}
                              >
                                Review in Make Report
                              </Button>
                              {selectedErTeamReport.status !== "in_review" && selectedErTeamReport.status !== "approved" ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-orange-300 text-orange-700 hover:bg-white"
                                  disabled={erTeamReportsActionLoading}
                                  onClick={() => void handleErTeamReportAction("in_review")}
                                >
                                  {erTeamReportsActionLoading ? "Updating…" : "Mark in review"}
                                </Button>
                              ) : null}
                              {selectedErTeamReport.status !== "approved" ? (
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                                  disabled={erTeamReportsActionLoading}
                                  onClick={() => void handleErTeamReportAction("approve")}
                                >
                                  {erTeamReportsActionLoading ? "Updating…" : "Approve report"}
                                </Button>
                              ) : null}
                            </div>
                          </div>

                          <div className="space-y-3 text-sm text-gray-700">
                            {(() => {
                              const patients = Array.isArray(selectedErTeamReport.patient_payload) ? selectedErTeamReport.patient_payload : [selectedErTeamReport.patient_payload].filter(Boolean)
                              const firstPatient = patients[0]
                              if (!firstPatient) return null
                              
                              const patientInfo = firstPatient.patientInformation
                              if (!patientInfo) return null
                              
                              const name = `${patientInfo.firstName ?? ""} ${patientInfo.lastName ?? ""}`.trim()
                              const hasName = name.length > 0
                              const hasAge = Boolean(patientInfo.age)
                              const hasSex = typeof patientInfo.sex === "string" && patientInfo.sex.length > 0
                              if (!hasName && !hasAge && !hasSex) return null
                              
                              return (
                                <div>
                                  <p className="text-xs uppercase text-orange-800/80">Lead patient {patients.length > 1 ? `(1 of ${patients.length})` : ""}</p>
                                  {hasName ? <p className="font-medium">{name}</p> : null}
                                  {hasAge || hasSex ? (
                                    <p className="text-xs text-gray-500">
                                      {hasAge ? `Age: ${patientInfo.age}` : null}
                                      {hasAge && hasSex ? " · " : ""}
                                      {hasSex ? `Sex: ${patientInfo.sex}` : null}
                                    </p>
                                  ) : null}
                                </div>
                              )
                            })()}

                            {(() => {
                              const incident = selectedErTeamReport.incident_payload
                              const typeLabel = incident?.incidentTypeLabel
                              const date = incident?.incidentDate
                              const time = incident?.incidentTime
                              if (!typeLabel && !date && !time) return null
                              return (
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                  <div>
                                    <p className="text-xs uppercase text-orange-800/80">Incident details</p>
                                    {typeLabel ? <p className="font-medium">{typeLabel}</p> : null}
                                    {date || time ? (
                                      <p className="text-xs text-gray-500">
                                        {[date, time].filter(Boolean).join(" · ")}
                                      </p>
                                    ) : null}
                                  </div>
                                  {selectedErTeamReport.notes ? (
                                    <div>
                                      <p className="text-xs uppercase text-orange-800/80">Notes</p>
                                      <p className="text-sm text-gray-600">{selectedErTeamReport.notes}</p>
                                    </div>
                                  ) : null}
                                </div>
                              )
                            })()}

                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full"><p className="text-gray-500">Select a report to view details.</p></div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1">
              <Card className="shadow-lg h-full">
                <CardHeader className="bg-orange-600 text-white"><CardTitle>All Reports</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-y-auto max-h-[400px] custom-scrollbar">
                    <table className="min-w-full divide-y divide-gray-200">
                      <tbody className="bg-white divide-y divide-gray-200">
                        {allReports.map((report) => (
                          <tr
                            key={report.id}
                            onClick={() => handleReportClick(report)}
                            className={`hover:bg-gray-100 cursor-pointer ${selectedReport?.id === report.id ? 'bg-blue-100' : ''}`}
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm font-medium">{report.firstName} {report.lastName}</div>
                              <div className="text-xs text-gray-500">{report.emergency_type}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  (report.status.trim().toLowerCase() === 'pending' || report.status.trim().toLowerCase() === 'active')
                                    ? 'bg-red-100 text-red-800'
                                    : report.status.trim().toLowerCase() === 'responded'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : report.status.trim().toLowerCase() === 'resolved'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {report.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
      </main>

      
      <Dialog open={showActiveModal} onOpenChange={setShowActiveModal}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Active / Pending Emergencies</DialogTitle>
            <DialogDescription>
              List of all emergency reports currently in 'active' or 'pending' status.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {activeReportsList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reporter</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reported At</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {activeReportsList.map(report => (
                      <tr key={report.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => { handleReportClick(report); setShowActiveModal(false); }}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{report.firstName} {report.lastName}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{report.emergency_type}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{report.location_address}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${report.status.trim().toLowerCase() === 'pending' || report.status.trim().toLowerCase() === 'active' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                            {report.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{format(new Date(report.created_at), 'PPP HH:mm')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-4">No active or pending reports.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      
      <Dialog open={showRespondedModal} onOpenChange={setShowRespondedModal}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>In-Progress (Responded) Emergencies</DialogTitle>
            <DialogDescription>
              List of all emergency reports currently in 'responded' status.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {respondedReportsList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reporter</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Responded At</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {respondedReportsList.map(report => (
                      <tr key={report.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => { handleReportClick(report); setShowRespondedModal(false); }}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{report.firstName} {report.lastName}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{report.emergency_type}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{report.location_address}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800`}>
                            {report.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{report.responded_at ? format(new Date(report.responded_at), 'PPP HH:mm') : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-4">No in-progress reports.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent className="w-80">
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>
              Are you sure you want to log out of the admin dashboard?
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
  );
}
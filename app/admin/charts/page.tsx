"use client"

import { ChartsDashboard } from "@/components/admin/charts-dashboard";
import { supabase } from "@/lib/supabase";
import { useState, useEffect, useCallback } from "react";

interface Report {
  id: string;
  emergency_type: string;
  status: string;
  created_at: string;
}

interface InternalReport {
  id: number;
  original_report_id: string | null;
  incident_type_id: number;
  incident_date: string;
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

export default function ChartsPage() {
  const [allEmergencyReports, setAllEmergencyReports] = useState<Report[]>([]);
  const [allInternalReports, setAllInternalReports] = useState<InternalReport[]>([]);
  const [barangays, setBarangays] = useState<BaseEntry[]>([]);
  const [incidentTypes, setIncidentTypes] = useState<BaseEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'ok' | 'degraded' | 'offline'>('ok');
  const [loading, setLoading] = useState(true);

  const fetchAllEmergencyReports = useCallback(async () => {
    const { data, error } = await supabase
      .from('emergency_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching emergency reports:", error);
      const msg = String(error?.message || '').toLowerCase();
      if (msg.includes('failed to fetch')) {
        setConnectionStatus('degraded');
      } else {
        setError(`Failed to load emergency reports: ${error.message || 'Unknown error'}.`);
      }
      return [];
    }
    setConnectionStatus('ok');
    return data || [];
  }, []);

  const fetchAllInternalReports = useCallback(async () => {
    const { data, error } = await supabase
      .from('internal_reports')
      .select('*')
      .order('incident_date', { ascending: false });

    if (error) {
      console.error("Error fetching internal reports:", error);
      const msg = String(error?.message || '').toLowerCase();
      if (msg.includes('failed to fetch')) {
        setConnectionStatus('degraded');
      } else {
        setError(`Failed to load internal reports: ${error.message || 'Unknown error'}.`);
      }
      return [];
    }
    setConnectionStatus('ok');
    return data || [];
  }, []);

  const fetchBarangays = useCallback(async () => {
    const { data, error } = await supabase
      .from('barangays')
      .select('id, name')
      .order('name', { ascending: true });
    if (error) {
      console.error("Error fetching Barangays:", error);
      const msg = String(error?.message || '').toLowerCase();
      if (msg.includes('failed to fetch')) {
        setConnectionStatus('degraded');
      } else {
        setError(`Failed to load Barangays: ${error.message}`);
      }
      return [];
    }
    setConnectionStatus('ok');
    return data as BaseEntry[] || [];
  }, []);

  const fetchIncidentTypes = useCallback(async () => {
    const { data, error } = await supabase
      .from('incident_types')
      .select('id, name')
      .order('name', { ascending: true });
    if (error) {
      console.error("Error fetching Incident Types:", error);
      const msg = String(error?.message || '').toLowerCase();
      if (msg.includes('failed to fetch')) {
        setConnectionStatus('degraded');
      } else {
        setError(`Failed to load Incident Types: ${error.message}`);
      }
      return [];
    }
    setConnectionStatus('ok');
    return data as BaseEntry[] || [];
  }, []);

  useEffect(() => {
    const loadAllChartData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [
          emergencyReportsData,
          internalReportsData,
          barangaysData,
          incidentTypesData
        ] = await Promise.all([
          fetchAllEmergencyReports(),
          fetchAllInternalReports(),
          fetchBarangays(),
          fetchIncidentTypes()
        ]);

        setAllEmergencyReports(emergencyReportsData);
        setAllInternalReports(internalReportsData);
        setBarangays(barangaysData);
        setIncidentTypes(incidentTypesData);

      } catch (err: any) {
        console.error("Error loading chart data:", err);
        setConnectionStatus('degraded');
      } finally {
        setLoading(false);
      }
    };

    loadAllChartData();

    const emergencyReportsChannel = supabase
      .channel('charts-emergency-reports-realtime-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'emergency_reports' },
        () => { fetchAllEmergencyReports().then(setAllEmergencyReports); }
      )
      .subscribe();

    const internalReportsChannel = supabase
      .channel('charts-internal-reports-realtime-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'internal_reports' },
        () => { fetchAllInternalReports().then(setAllInternalReports); }
      )
      .subscribe();

    const barangaysChannel = supabase
      .channel('charts-barangays-realtime-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'barangays' },
        () => { fetchBarangays().then(setBarangays); }
      )
      .subscribe();

    const incidentTypesChannel = supabase
      .channel('charts-incident-types-realtime-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incident_types' },
        () => { fetchIncidentTypes().then(setIncidentTypes); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(emergencyReportsChannel);
      supabase.removeChannel(internalReportsChannel);
      supabase.removeChannel(barangaysChannel);
      supabase.removeChannel(incidentTypesChannel);
    };
  }, [fetchAllEmergencyReports, fetchAllInternalReports, fetchBarangays, fetchIncidentTypes]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 flex items-center justify-center text-gray-600 font-sans">
        Loading chart data...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 font-sans text-gray-800">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Analytics & Charts</h1>
        <div className="flex items-center gap-3">
          {connectionStatus !== 'ok' && (
            <span className={`hidden sm:inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${connectionStatus === 'offline' ? 'bg-red-100 text-red-800 border-red-300' : 'bg-yellow-100 text-yellow-800 border-yellow-300'}`}>
              {connectionStatus === 'offline' ? 'Offline' : 'Connection degraded'}
            </span>
          )}
          {error && (
            <span className="hidden sm:inline-flex items-center px-2 py-1 rounded text-xs font-medium border bg-red-100 text-red-800 border-red-300" title={error}>
              Data error
            </span>
          )}
        </div>
      </div>
      <ChartsDashboard
        allEmergencyReports={allEmergencyReports}
        allInternalReports={allInternalReports}
        barangays={barangays}
        incidentTypes={incidentTypes}
      />
    </div>
  );
}
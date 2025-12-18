"use client"

import { DataManagement } from "@/components/admin/data-management";
import { supabase } from "@/lib/supabase";
import { useState, useEffect, useCallback } from "react";

interface BaseEntry {
  id: number;
  name: string;
}

export default function DataManagementPage() {
  const [erTeams, setErTeams] = useState<BaseEntry[]>([]);
  const [barangays, setBarangays] = useState<BaseEntry[]>([]);
  const [incidentTypes, setIncidentTypes] = useState<BaseEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchErTeams = useCallback(async () => {
    const { data, error } = await supabase
      .from('er_teams')
      .select('id, name')
      .order('name', { ascending: true });
    if (error) {
      console.error("Error fetching ER Teams:", error);
      setError(`Failed to load ER Teams: ${error.message}`);
      return [];
    }
    return data as BaseEntry[] || [];
  }, []);

  const fetchBarangays = useCallback(async () => {
    const { data, error } = await supabase
      .from('barangays')
      .select('id, name')
      .order('name', { ascending: true });
    if (error) {
      console.error("Error fetching Barangays:", error);
      setError(`Failed to load Barangays: ${error.message}`);
      return [];
    }
    return data as BaseEntry[] || [];
  }, []);

  const fetchIncidentTypes = useCallback(async () => {
    const { data, error } = await supabase
      .from('incident_types')
      .select('id, name')
      .order('name', { ascending: true });
    if (error) {
      console.error("Error fetching Incident Types:", error);
      setError(`Failed to load Incident Types: ${error.message}`);
      return [];
    }
    return data as BaseEntry[] || [];
  }, []);

  useEffect(() => {
    fetchErTeams().then(setErTeams);
    fetchBarangays().then(setBarangays);
    fetchIncidentTypes().then(setIncidentTypes);

    const erTeamsChannel = supabase
      .channel('data-er-teams-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'er_teams' },
        () => { fetchErTeams().then(setErTeams); }
      )
      .subscribe();

    const barangaysChannel = supabase
      .channel('data-barangays-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'barangays' },
        () => { fetchBarangays().then(setBarangays); }
      )
      .subscribe();

    const incidentTypesChannel = supabase
      .channel('data-incident-types-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incident_types' },
        () => { fetchIncidentTypes().then(setIncidentTypes); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(erTeamsChannel);
      supabase.removeChannel(barangaysChannel);
      supabase.removeChannel(incidentTypesChannel);
    };
  }, [fetchErTeams, fetchBarangays, fetchIncidentTypes]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 flex items-center justify-center text-red-500 font-sans">
        Error loading data: {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 font-sans text-gray-800">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Data Management</h1>
      <DataManagement
        erTeams={erTeams}
        barangays={barangays}
        incidentTypes={incidentTypes}
        fetchErTeams={fetchErTeams}
        fetchBarangays={fetchBarangays}
        fetchIncidentTypes={fetchIncidentTypes}
      />
    </div>
  );
}
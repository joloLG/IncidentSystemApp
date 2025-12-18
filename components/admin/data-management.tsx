"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { supabase } from "@/lib/supabase"
import { PlusCircle, Edit, Trash2, Save, X, CheckCircle2, XCircle, ArrowLeft } from "lucide-react" // Added icons, ArrowLeft
import Link from "next/link";

// Interfaces for data types
interface BaseEntry {
  id: number;
  name: string;
}

interface DataManagementProps {
  erTeams: BaseEntry[];
  barangays: BaseEntry[];
  incidentTypes: BaseEntry[];
  fetchErTeams: () => Promise<BaseEntry[]>;
  fetchBarangays: () => Promise<BaseEntry[]>;
  fetchIncidentTypes: () => Promise<BaseEntry[]>;
}

export function DataManagement({ erTeams, barangays, incidentTypes, fetchErTeams, fetchBarangays, fetchIncidentTypes }: DataManagementProps) {

  // Real-time subscriptions for er_teams, barangays, and incident_types
  React.useEffect(() => {
    const erTeamsChannel = supabase.channel('realtime-er_teams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'er_teams' }, () => {
        fetchErTeams();
      })
      .subscribe();

    const barangaysChannel = supabase.channel('realtime-barangays')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'barangays' }, () => {
        fetchBarangays();
      })
      .subscribe();

    const incidentTypesChannel = supabase.channel('realtime-incident_types')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incident_types' }, () => {
        fetchIncidentTypes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(erTeamsChannel);
      supabase.removeChannel(barangaysChannel);
      supabase.removeChannel(incidentTypesChannel);
    };
  }, [fetchErTeams, fetchBarangays, fetchIncidentTypes]);

  const [newEntryName, setNewEntryName] = React.useState('');
  const [editingEntryId, setEditingEntryId] = React.useState<number | null>(null);
  const [editingEntryName, setEditingEntryName] = React.useState('');
  const [currentTab, setCurrentTab] = React.useState('er_teams');
  const [isLoadingAction, setIsLoadingAction] = React.useState(false);
  const [formMessage, setFormMessage] = React.useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<number | null>(null); // State for delete confirmation modal

  const handleAddEntry = async (tableName: string, fetchFunction: () => Promise<any[]>) => {
    if (!newEntryName.trim()) {
      setFormMessage({ type: 'error', text: "Entry name cannot be empty." });
      return;
    }
    setIsLoadingAction(true);
    setFormMessage(null);
    try {
      const { data, error } = await supabase
        .from(tableName)
        .insert({ name: newEntryName.trim() })
        .select();

      if (error) throw error;
      setFormMessage({ type: 'success', text: `Successfully added "${newEntryName}" to ${tableName.replace('_', ' ')}.` });
      setNewEntryName('');
      await fetchFunction();
    } catch (err: any) {
      console.error(`Error adding entry to ${tableName}:`, err);
      setFormMessage({ type: 'error', text: `Failed to add entry: ${err.message}` });
    } finally {
      setIsLoadingAction(false);
    }
  };

  const handleUpdateEntry = async (tableName: string, id: number, fetchFunction: () => Promise<any[]>) => {
    if (!editingEntryName.trim()) {
      setFormMessage({ type: 'error', text: "Entry name cannot be empty." });
      return;
    }
    setIsLoadingAction(true);
    setFormMessage(null);
    try {
      const { data, error } = await supabase
        .from(tableName)
        .update({ name: editingEntryName.trim() })
        .eq('id', id)
        .select();

      if (error) throw error;
      setFormMessage({ type: 'success', text: `Successfully updated entry to "${editingEntryName}".` });
      setEditingEntryId(null);
      setEditingEntryName('');
      await fetchFunction();
    } catch (err: any) {
      console.error(`Error updating entry in ${tableName}:`, err);
      setFormMessage({ type: 'error', text: `Failed to update entry: ${err.message}` });
    } finally {
      setIsLoadingAction(false);
    }
  };

  const handleDeleteEntry = async (tableName: string, id: number, fetchFunction: () => Promise<any[]>) => {
    setIsLoadingAction(true);
    setFormMessage(null);
    setDeleteConfirmId(null); // Close confirmation modal
    try {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);

      if (error) throw error;
      setFormMessage({ type: 'success', text: `Entry deleted successfully from ${tableName.replace('_', ' ')}.` });
      await fetchFunction();
    } catch (err: any) {
      console.error(`Error deleting entry from ${tableName}:`, err);
      setFormMessage({ type: 'error', text: `Failed to delete entry: ${err.message}` });
    } finally {
      setIsLoadingAction(false);
    }
  };

  const renderTable = (data: BaseEntry[], tableName: string, fetchFunction: () => Promise<any[]>) => (
    <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50 shadow-inner">
      <div className="flex items-center space-x-3 mb-4">
        <Input
          type="text"
          placeholder={`Add new ${tableName.replace('_', ' ')}...`}
          value={newEntryName}
          onChange={(e) => setNewEntryName(e.target.value)}
          className="flex-grow p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm"
          disabled={isLoadingAction}
        />
        <Button
          onClick={() => handleAddEntry(tableName, fetchFunction)}
          disabled={isLoadingAction || !newEntryName.trim()}
          className="bg-green-600 hover:bg-green-700 text-white rounded-md px-4 py-2 flex items-center shadow-md"
        >
          <PlusCircle className="h-4 w-4 mr-2" /> Add
        </Button>
      </div>
      <ul className="space-y-3">
        {data.length > 0 ? (
          data.map((item) => (
            <li key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border border-gray-300 rounded-lg bg-white shadow-sm">
              {editingEntryId === item.id ? (
                <div className="flex-grow w-full flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2">
                  <Input
                    type="text"
                    value={editingEntryName}
                    onChange={(e) => setEditingEntryName(e.target.value)}
                    className="flex-grow p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm w-full"
                    disabled={isLoadingAction}
                  />
                  <div className="flex space-x-2 mt-2 sm:mt-0 w-full sm:w-auto">
                    <Button
                      size="sm"
                      onClick={() => handleUpdateEntry(tableName, item.id, fetchFunction)}
                      disabled={isLoadingAction || !editingEntryName.trim()}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-1.5 flex items-center shadow-sm w-1/2 sm:w-auto"
                    >
                      <Save className="h-4 w-4 mr-1" /> Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setEditingEntryId(null); setEditingEntryName(''); }}
                      disabled={isLoadingAction}
                      className="border-gray-300 hover:bg-gray-100 text-gray-700 rounded-md px-3 py-1.5 flex items-center shadow-sm w-1/2 sm:w-auto"
                    >
                      <X className="h-4 w-4 mr-1" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="font-medium text-gray-800 text-lg">{item.name}</span>
                  <div className="flex space-x-2 mt-2 sm:mt-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingEntryId(item.id);
                        setEditingEntryName(item.name);
                        setFormMessage(null); // Clear messages when starting edit
                      }}
                      disabled={isLoadingAction}
                      className="border-gray-300 hover:bg-gray-100 text-gray-700 rounded-md px-3 py-1.5 flex items-center shadow-sm"
                    >
                      <Edit className="h-4 w-4 mr-1" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteConfirmId(item.id)} // Open confirmation modal
                      disabled={isLoadingAction}
                      className="bg-red-600 hover:bg-red-700 text-white rounded-md px-3 py-1.5 flex items-center shadow-sm"
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </Button>
                  </div>
                </>
              )}
              {deleteConfirmId === item.id && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full text-center">
                    <h4 className="text-lg font-bold mb-4">Confirm Deletion</h4>
                    <p className="text-gray-700 mb-6">Are you sure you want to delete "{item.name}"?</p>
                    <div className="flex justify-center space-x-4">
                      <Button
                        variant="outline"
                        onClick={() => setDeleteConfirmId(null)}
                        disabled={isLoadingAction}
                        className="px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-100"
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleDeleteEntry(tableName, item.id, fetchFunction)}
                        disabled={isLoadingAction}
                        className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </li>
          ))
        ) : (
          <li className="p-4 text-center text-gray-500">No {tableName.replace('_', ' ')} found.</li>
        )}
      </ul>
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-6">
    {/* Back Button for Admin Dashboard */}
    <div className="flex justify-start mb-4">
      <Button
        variant="outline"
        className="bg-gray-200 hover:bg-gray-300 text-gray-800"
        asChild
      >
        <Link href="/">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Link>
      </Button>
    </div>

    {/* Pie Chart: Incidents per Barangay */}
    <Card className="shadow-lg h-full lg:col-span-3 rounded-lg">
      <CardHeader className="bg-orange-600 text-white rounded-t-lg p-4 flex justify-between items-center">
        <CardTitle className="text-2xl font-bold items-center ">Data Management</CardTitle>
      </CardHeader>
      <CardContent className="p-6 bg-white rounded-b-lg">
        {formMessage && (
          <div className={`p-3 mb-4 rounded-md flex items-center space-x-2 ${
            formMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {formMessage.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            <p className="text-sm font-medium">{formMessage.text}</p>
          </div>
        )}

        <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-200 rounded-md p-1 shadow-inner">
            <TabsTrigger
              value="er_teams"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-md transition-all duration-200"
            >
              ER Teams
            </TabsTrigger>
            <TabsTrigger
              value="barangays"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-md transition-all duration-200"
            >
              Barangays
            </TabsTrigger>
            <TabsTrigger
              value="incident_types"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-md transition-all duration-200"
            >
              Incident Types
            </TabsTrigger>
          </TabsList>
          <TabsContent value="er_teams">
            {renderTable(erTeams, 'er_teams', fetchErTeams)}
          </TabsContent>
          <TabsContent value="barangays">
            {renderTable(barangays, 'barangays', fetchBarangays)}
          </TabsContent>
          <TabsContent value="incident_types">
            {renderTable(incidentTypes, 'incident_types', fetchIncidentTypes)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
    </div>
  )
}

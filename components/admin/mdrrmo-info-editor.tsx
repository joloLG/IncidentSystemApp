"use client"

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Info, Edit, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

interface MdrrmoInfo {
  id: string;
  content: string;
  last_updated_at: string;
}

export function MdrrmoInfoEditor() {
  const [mdrrmoInfoContent, setMdrrmoInfoContent] = useState<string>('');
  const [mdrrmoInfoId, setMdrrmoInfoId] = useState<string | null>(null);
  const [mdrrmoInfoSaveMessage, setMdrrmoInfoSaveMessage] = useState<string | null>(null);
  const [mdrrmoInfoSaveError, setMdrrmoInfoSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMdrrmoInfoForEdit = useCallback(async () => {
    setLoading(true);
    setMdrrmoInfoSaveError(null);
    try {
      const { data, error } = await supabase
        .from('mdrrmo_info')
        .select('*')
        .single();

      if (!error && data) {
        setMdrrmoInfoContent(data.content);
        setMdrrmoInfoId(data.id);
      } else if (error && error.code !== 'PGRST116') {
        console.error("Error fetching MDRRMO Info for edit:", error);
        setMdrrmoInfoSaveError(`Failed to load MDRRMO info: ${error.message}`);
      } else if (error && error.code === 'PGRST116') {
        console.log("No MDRRMO Information found for editing. It can be created.");
        setMdrrmoInfoContent('');
        setMdrrmoInfoId(null);
      }
    } catch (err: any) {
      console.error("Unexpected error fetching MDRRMO Info:", err);
      setMdrrmoInfoSaveError(`An unexpected error occurred: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMdrrmoInfoForEdit();
    const mdrrmoInfoChannel = supabase
      .channel('mdrrmo-info-editor-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mdrrmo_info' }, () => {
        console.log('Change received on mdrrmo_info, refetching.');
        fetchMdrrmoInfoForEdit();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(mdrrmoInfoChannel);
    };
  }, [fetchMdrrmoInfoForEdit]);
  const handleSaveMdrrmoInfo = async () => {
    setMdrrmoInfoSaveMessage(null);
    setMdrrmoInfoSaveError(null);
    if (!mdrrmoInfoContent.trim()) {
      setMdrrmoInfoSaveError("Information content cannot be empty.");
      return;
    }

    try {
      if (mdrrmoInfoId) {
        const { error } = await supabase
          .from('mdrrmo_info')
          .update({ content: mdrrmoInfoContent, last_updated_at: new Date().toISOString() })
          .eq('id', mdrrmoInfoId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('mdrrmo_info')
          .insert({ content: mdrrmoInfoContent, last_updated_at: new Date().toISOString() })
          .select('id')
          .single();
        if (error) throw error;
        setMdrrmoInfoId(data.id); // New ID for the MDRRMO Info
      }
      setMdrrmoInfoSaveMessage("MDRRMO Information saved successfully!");
    } catch (error: any) {
      console.error("Error saving MDRRMO Info:", error);
      setMdrrmoInfoSaveError(`Failed to save information: ${error.message}. Please check your Supabase RLS policies for 'mdrrmo_info'.`);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-lg h-full">
        <CardHeader className="bg-orange-800 text-black flex justify-between items-center">
          <div className="flex items-center">
            <Info className="mr-2 h-5 w-5" />
            <span>Edit MDRRMO-Bulan Information</span>
          </div>
          <div className="w-24"></div> 
        </CardHeader>
        <CardContent className="p-6 text-center">
          Loading MDRRMO Information...
        </CardContent>
      </Card>
    );
  }

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
    <Card className="shadow-lg h-full">
      <CardHeader className="bg-orange-600 text-white flex justify-between items-center">
        <CardTitle className="flex items-center">
        </CardTitle>
        <div className="flex items-center">
          <Info className="mr-2 h-5 w-5" />
          <span>Edit MDRRMO-Bulan Information</span>
        </div>
        <div className="w-24"></div> {/* Spacer for balance */}
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          <p className="text-black-700">Update the general information about MDRRMO-Bulan that users will see on their dashboard.</p>
          <div>
            <label htmlFor="mdrrmo-content" className="block text-sm font-medium text-gray-700 mb-1">
              Information Content
            </label>
            <Textarea
              id="mdrrmo-content"
              value={mdrrmoInfoContent}
              onChange={(e) => setMdrrmoInfoContent(e.target.value)}
              rows={10}
              placeholder="Enter MDRRMO-Bulan information here..."
              className="w-full"
            />
          </div>
          <Button 
            onClick={handleSaveMdrrmoInfo} 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Edit className="mr-2 h-4 w-4" />
            Save Information
          </Button>
          {mdrrmoInfoSaveMessage && (
            <p className="text-green-600 text-sm mt-2 text-center">
              {mdrrmoInfoSaveMessage}
            </p>
          )}
          {mdrrmoInfoSaveError && (
            <p className="text-red-600 text-sm mt-2 text-center">
              {mdrrmoInfoSaveError}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
    </div>
  );
}

export default MdrrmoInfoEditor;

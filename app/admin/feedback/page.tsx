"use client"

import { FeedbackViewer } from "@/components/admin/feedback-viewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import React from "react";

export default function FeedbackPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 font-sans text-gray-800">
      <div className="flex items-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">User Feedback Management</h1>
      </div>
      <Card className="bg-white shadow-sm">
        <CardContent className="p-6">
          <FeedbackViewer />
        </CardContent>
      </Card>
    </div>
  );
}

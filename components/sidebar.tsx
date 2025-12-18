"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import Link from "next/link"
// Added new icons for the admin-specific menu items
import { Menu, BarChart, Settings, FileText, History, Info, Phone, Mail, X, MapPin, Bell, Flame, Megaphone } from "lucide-react"
import { Newspaper } from "lucide-react"

type AdminViewType = 'main' | 'editMdrrmoInfo' | 'editHotlines' | 'viewFeedback';

interface SidebarProps {
  onAdminViewChange?: (view: AdminViewType | string) => void;
  currentAdminView?: string;
  unreadFeedbackCount?: number;
}

export function Sidebar({ onAdminViewChange, currentAdminView, unreadFeedbackCount }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Navigation is handled via Link anchors; close the sheet on left-click navigation.
  
  // Helper function to check if a path is active
  const isActive = (path: string) => {
    return typeof window !== 'undefined' ? window.location.pathname.includes(path) : false;
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {/* The menu button for the sidebar */}
        <Button variant="ghost" size="icon" className="mr-2">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[250px] sm:w-[300px] flex flex-col"
        aria-describedby={undefined}
      >
        <SheetHeader>
          <SheetTitle>Admin Menu</SheetTitle>
          {/* The close button is intentionally removed as per previous instruction */}
        </SheetHeader>
        <nav className="flex flex-col gap-2 mt-4">
          {/* Navigation items using in-app routing */}
          <Button variant="ghost" className="justify-start" asChild>
            <Link href="/admin/charts" onClick={() => setIsOpen(false)}>
              <BarChart className="mr-2 h-4 w-4" /> Charts and Analytics
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start" asChild>
            <Link href="/admin/heatmap" onClick={() => setIsOpen(false)}>
              <Flame className="mr-2 h-4 w-4" /> Incident Heat Map
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start" asChild>
            <Link href="/admin/data" onClick={() => setIsOpen(false)}>
              <Settings className="mr-2 h-4 w-4" /> Data Management
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start" asChild>
            <Link href="/admin/report" onClick={() => setIsOpen(false)}>
              <FileText className="mr-2 h-4 w-4" /> Report Management
            </Link>
          </Button>
          <Button variant="ghost" className={`justify-start ${isActive('narrative-reports') ? 'bg-blue-100 text-blue-800' : ''}`} asChild>
            <Link href="/admin/narrative-reports" onClick={() => setIsOpen(false)}>
              <Newspaper className="mr-2 h-4 w-4" /> Narrative Reports
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start" asChild>
            <Link href="/admin/report-history" onClick={() => setIsOpen(false)}>
              <History className="mr-2 h-4 w-4" /> History of Report
            </Link>
          </Button>
          <Button
            variant="ghost"
            className={`justify-start ${isActive('mdrrmo-info') ? 'bg-blue-100 text-blue-800' : ''}`}
            asChild
          >
            <Link href="/admin/mdrrmo-info" onClick={() => setIsOpen(false)}>
              <Info className="mr-2 h-4 w-4" /> MDRRMO Information
            </Link>
          </Button>
          <Button
            variant="ghost"
            className={`justify-start ${isActive('hotlines') ? 'bg-blue-100 text-blue-800' : ''}`}
            asChild
          >
            <Link href="/admin/hotlines" onClick={() => setIsOpen(false)}>
              <Phone className="mr-2 h-4 w-4" /> Hotlines Management
            </Link>
          </Button>
          <Button
            variant="ghost"
            className={`justify-start ${isActive('alerts') ? 'bg-blue-100 text-blue-800' : ''}`}
            asChild
          >
            <Link href="/admin/alerts" onClick={() => setIsOpen(false)}>
              <Bell className="mr-2 h-4 w-4" /> Alert Management
            </Link>
          </Button>
          <Button
            variant="ghost"
            className={`justify-start ${isActive('advisory') ? 'bg-blue-100 text-blue-800' : ''}`}
            asChild
          >
            <Link href="/admin/advisory" onClick={() => setIsOpen(false)}>
              <Megaphone className="mr-2 h-4 w-4" /> Advisory Management
            </Link>
          </Button>
          <Button
            variant="ghost"
            className={`justify-start relative ${isActive('feedback') ? 'bg-blue-100 text-blue-800' : ''}`}
            asChild
          >
            <Link href="/admin/feedback" onClick={() => setIsOpen(false)}>
              <Mail className="mr-2 h-4 w-4" /> Users Feedback
              {unreadFeedbackCount !== undefined && unreadFeedbackCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadFeedbackCount}
                </span>
              )}
            </Link>
          </Button>
        </nav>
        <div className="mt-auto pt-4 text-xs text-gray-500 border-t flex items-center justify-center">
          Copyright © 2025 | Jolo Gracilla
        </div>
      </SheetContent>
    </Sheet>
  )
}
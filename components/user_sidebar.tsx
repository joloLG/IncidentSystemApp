"use client"

import React from 'react';
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertTriangle, History, Info, Phone, User, Mail, X, Download, Share } from "lucide-react"
import { useAppStore } from '@/lib/store';

interface UserSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onChangeView: (view: string) => void;
}

const menuItems = [
  { id: 'main', icon: AlertTriangle, label: 'Main Dashboard', type: 'internal' },
  { id: 'reportHistory', icon: History, label: 'Report History', type: 'internal' },
  { id: 'mdrrmoInfo', icon: Info, label: 'Bulan Information Hotlines', type: 'internal' },
  { id: 'incidentPosts', icon: AlertTriangle, label: 'MDRRMO Incident Posts', type: 'internal' },
  { id: 'userProfile', icon: User, label: 'User Profile', type: 'internal' },
  { id: 'sendFeedback', icon: Mail, label: 'Send Feedback', type: 'internal' },
];

export function UserSidebar({ isOpen, onClose, onChangeView }: UserSidebarProps) {
  const installPromptEvent = useAppStore(state => state.installPromptEvent);
  const setInstallPromptEvent = useAppStore(state => state.setInstallPromptEvent);

  const [showIosA2HS, setShowIosA2HS] = React.useState(false);
  const [iosDialogOpen, setIosDialogOpen] = React.useState(false);
  const [showAndroidDownload, setShowAndroidDownload] = React.useState(false);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  React.useEffect(() => {
    // Detect iOS devices (including iPadOS masquerading as Mac) and non-standalone mode
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    if (isIosDevice && !isStandalone) {
      setShowIosA2HS(true);
    }
    if (/android/.test(ua) && !isStandalone) {
      setShowAndroidDownload(true);
    }
  }, []);

  const handleMenuItemClick = (item: { id: string; type: string; path?: string }) => {
    if (item.type === 'internal' && item.path) {
      const fullPath = window.location.origin + item.path;
      window.location.href = fullPath;
      onClose();
    } else if (item.type === 'internal') {
      onChangeView(item.id);
      onClose();
    } else if (item.type === 'external' && item.path) {
      window.location.href = item.path;
      onClose();
    }
  };

  const handleInstallClick = () => {
    if (!installPromptEvent) return;
    (installPromptEvent as any).prompt();
    setInstallPromptEvent(null);
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ease-in-out lg:hidden"
          onClick={handleOverlayClick}
          role="button"
          aria-label="Close menu"
          tabIndex={0}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-screen w-64 bg-gray-800 text-white shadow-lg z-50 transform transition-transform duration-300 ease-in-out ${
          // Mobile: slide in/out from left
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${
          // Desktop: always visible, positioned to take full height
          'lg:translate-x-0'
        }`}
        aria-label="Main navigation"
      >
        <div className="h-full flex flex-col">
          <div className="p-4 flex items-center justify-between border-b border-gray-700">
            <h2 className="text-xl font-bold">Menu</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="Close menu"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {showIosA2HS && (
              <Button
                variant="ghost"
                className="w-full justify-start text-white bg-blue-600 hover:bg-blue-700 hover:text-white text-left h-auto py-3"
                onClick={() => setIosDialogOpen(true)}
              >
                <Share className="mr-3 h-5 w-5 flex-shrink-0 mt-0.5" />
                <span className="break-words leading-tight">Add to Home Screen</span>
              </Button>
            )}
            {installPromptEvent && (
              <Button
                variant="ghost"
                className="w-full justify-start text-white bg-green-600 hover:bg-green-700 hover:text-white text-left h-auto py-3"
                onClick={handleInstallClick}
              >
                <Download className="mr-3 h-5 w-5 flex-shrink-0 mt-0.5" />
                <span className="break-words leading-tight">ADD TO HOME</span>
              </Button>
            )}
            {showAndroidDownload && (
              <Button
                variant="ghost"
                className="w-full justify-start text-white bg-purple-600 hover:bg-purple-700 hover:text-white text-left h-auto py-3"
                onClick={() => window.open('https://github.com/joloLG/MDRRMO-System/releases/tag/v1.1.6', '_blank', 'noopener,noreferrer')}
              >
                <Download className="mr-3 h-5 w-5 flex-shrink-0 mt-0.5" />
                <span className="break-words leading-tight">Download App</span>
              </Button>
            )}
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  className="w-full justify-start text-white hover:bg-gray-700 hover:text-white text-left h-auto py-3"
                  onClick={() => handleMenuItemClick(item as any)}
                >
                  <Icon className="mr-3 h-5 w-5 flex-shrink-0 mt-0.5" />
                  <span className="break-words leading-tight">{item.label}</span>
                  {item.type === 'external' && (
                    <span className="ml-auto text-xs text-gray-400 flex-shrink-0">↗</span>
                  )}
                </Button>
              );
            })}
          </nav>
          <div className="mt-auto p-4 text-xs text-gray-400 border-t border-gray-700">
            Copyright © 2025 | Jolo Gracilla
          </div>
        </div>
      </aside>
      {/* iOS Add to Home Screen instructions */}
      <Dialog open={iosDialogOpen} onOpenChange={setIosDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add MDRRMO App to Home Screen</DialogTitle>
            <DialogDescription>
              For iPhone/iPad using Safari or other iOS browsers:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              1. Tap the <span className="inline-flex items-center gap-1 font-medium"><Share className="inline h-4 w-4" /> Share</span> button in the browser toolbar.
            </p>
            <p>
              2. Scroll and choose <span className="font-medium">Add to Home Screen</span>.
            </p>
            <p>
              3. Tap <span className="font-medium">Add</span> to confirm.
            </p>
            <p className="text-muted-foreground">
              Tip: On iPad or in landscape, the Share button may be at the top-right.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

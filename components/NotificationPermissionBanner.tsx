"use client"

import { usePushNotifications } from "@/components/providers/PushNotificationsProvider";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Info } from "lucide-react";

export function NotificationPermissionBanner() {
  const { requestPermission, permissionStatus } = usePushNotifications();

  const isWebPushSupported = typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window;

  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = typeof window !== 'undefined' && (
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    // @ts-ignore - iOS Safari specific
    (navigator as any).standalone === true
  );

  if (permissionStatus === 'granted') {
    return null;
  }

  return (
    <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4" role="alert">
      <div className="flex items-center">
        <div className="py-1">
          {permissionStatus === 'denied' ? (
            <BellOff className="h-6 w-6 text-yellow-500 mr-4" />
          ) : (
            <Bell className="h-6 w-6 text-yellow-500 mr-4" />
          )}
        </div>
        <div>
          <p className="font-bold">Enable Notifications</p>
          <p className="text-sm">
            {permissionStatus === 'denied' && (
              <>You have blocked notifications. Please enable them in your browser or device settings to receive important updates.</>
            )}
            {permissionStatus !== 'denied' && (!isWebPushSupported) && (
              <>Your browser doesn't support web push on this device. Please use a modern browser or install the app.</>
            )}
            {permissionStatus !== 'denied' && isIOS && !isStandalone && isWebPushSupported && (
              <>On iPhone/iPad, install this app to your Home Screen first to enable notifications.</>
            )}
            {permissionStatus !== 'denied' && isWebPushSupported && (!isIOS || isStandalone) && (
              <>Get notified about your reports and other important updates.</>
            )}
          </p>
        </div>
        {permissionStatus !== 'denied' && isWebPushSupported && (
          <div className="ml-auto">
            <Button onClick={requestPermission} size="sm">
              Enable
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { toast } from 'sonner';

class NotificationManager {
  private audio: HTMLAudioElement | null = null;
  private static instance: NotificationManager;

  private constructor() {
    this.initialize();
  }

  public static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  private initialize() {
    // Preload the audio file
    this.audio = new Audio('/sounds/alert.mp3');
    this.audio.load();

    // Request notification permission
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }
  }

  public async showNotification(title: string, message: string) {
    // Play sound if tab is not active
    if (document.visibilityState !== 'visible') {
      await this.playSound();
    }

    // Show browser notification if allowed and tab is not active
    if (document.visibilityState !== 'visible' && this.hasNotificationPermission()) {
      this.showBrowserNotification(title, message);
    }

    // Always show in-app toast
    this.showInAppToast(message);
  }

  private async playSound() {
    try {
      const soundEnabled = localStorage.getItem('mdrrmo_admin_sound_enabled') !== 'false';
      if (soundEnabled && this.audio) {
        this.audio.currentTime = 0;
        await this.audio.play();
      }
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  }

  private hasNotificationPermission(): boolean {
    return 'Notification' in window && Notification.permission === 'granted';
  }

  private showBrowserNotification(title: string, message: string) {
    const notification = new Notification(title, {
      body: message,
      icon: '/icons/icon-192x192.png',
      vibrate: [200, 100, 200],
      requireInteraction: true
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }

  private showInAppToast(message: string) {
    toast(message, {
      duration: 10000,
      position: 'top-right',
      style: {
        background: '#ef4444',
        color: 'white',
        border: 'none',
        borderRadius: '0.5rem',
        padding: '1rem',
        fontSize: '0.875rem',
        fontWeight: 500,
      },
    });
  }
}

export default function NotificationService() {
  const supabase = createClientComponentClient();
  const notificationManager = useRef<NotificationManager>();

  useEffect(() => {
    // Initialize notification manager
    notificationManager.current = NotificationManager.getInstance();

    // Handle new emergency reports
    const channel = supabase
      .channel('realtime-emergency-reports')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'emergency_reports',
        },
        (payload) => {
          const report = payload.new as { emergency_type?: string; id: string };
          const emergencyType = report.emergency_type || 'Emergency';
          const title = `New ${emergencyType} Report`;
          const message = `A new ${emergencyType.toLowerCase()} report has been received.`;
          
          notificationManager.current?.showNotification(title, message);
        }
      )
      .subscribe();

    // Register service worker for push notifications
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => console.log('ServiceWorker registration successful'))
        .catch(err => console.error('ServiceWorker registration failed: ', err));
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  return null;
}

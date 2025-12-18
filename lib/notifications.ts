import * as React from 'react';
import { Toast, ToastAction } from "@/components/ui/toast";

// Audio element for notification sounds
let audio: HTMLAudioElement | null = null;

// Initialize audio
function initAudio() {
  if (typeof window !== 'undefined' && !audio) {
    audio = new Audio('/sounds/alert.mp3');
    audio.volume = 0.5; // Set volume to 50%
    audio.load();
  }
}

// Request notification permission
function requestNotificationPermission() {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      return Notification.requestPermission();
    }
    return Promise.resolve(Notification.permission);
  }
  return Promise.resolve('denied');
}

// Play notification sound
export async function playNotificationSound() {
  try {
    const soundEnabled = typeof window !== 'undefined' 
      ? localStorage.getItem('mdrrmo_admin_sound_enabled') !== 'false'
      : true;

    if (soundEnabled) {
      if (!audio) {
        initAudio();
      }
      if (audio) {
        audio.currentTime = 0;
        await audio.play().catch(e => console.error('Error playing sound:', e));
      }
    }
  } catch (error) {
    console.error('Error with notification sound:', error);
  }
}

// Show browser notification
export async function showBrowserNotification(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  try {
    if (Notification.permission === 'granted') {
      // Only show notification if tab is not active
      if (document.visibilityState === 'hidden') {
        const notification = new Notification(title, {
          body,
          icon: '/icons/icon-192x192.png',
          vibrate: [200, 100, 200],
          requireInteraction: true
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      }
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        showBrowserNotification(title, body);
      }
    }
  } catch (error) {
    console.error('Error showing browser notification:', error);
  }
}

// Show emergency notification with sound and browser notification
export async function showEmergencyNotification(emergencyType: string) {
  const title = `New ${emergencyType} Report`;
  const description = `A new ${emergencyType.toLowerCase()} report has been received.`;
  
  // Play sound and show browser notification
  await Promise.all([
    playNotificationSound(),
    showBrowserNotification(title, description)
  ]);
  
  // Return a simple notification object that can be rendered
  return {
    title,
    description,
    variant: 'destructive' as const
  };
}

// Service Worker registration for push notifications
export async function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('ServiceWorker registration successful');
      return registration;
    } catch (error) {
      console.error('ServiceWorker registration failed:', error);
    }
  }
  return null;
}

// Initialize the notification system
export function initializeNotifications() {
  if (typeof window !== 'undefined') {
    initAudio();
    requestNotificationPermission();
    registerServiceWorker();
  }
}

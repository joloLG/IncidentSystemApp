"use client"

"use client"

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';

export function PwaRegistry() {
  const setInstallPromptEvent = useAppStore(state => state.setInstallPromptEvent);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(registration => {
        console.log('Service Worker registered: ', registration);
      }).catch(registrationError => {
        console.log('Service Worker registration failed: ', registrationError);
      });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [setInstallPromptEvent]);

  return null;
}

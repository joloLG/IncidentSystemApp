"use client"

import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { supabase } from '@/lib/supabase';
import { getAlertSoundSignedUrl, clearAlertSoundCache } from '@/lib/alertSounds';
import { UserBroadcastOverlay } from '@/components/UserBroadcastOverlay';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const BROADCAST_OVERLAY_DURATION_MS = 15_000;
const BROADCAST_SOUND_VARIANT: 'earthquake' = 'earthquake';

interface PushNotificationsContextType {
  requestPermission: () => Promise<void>;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale';
  playAlertSound: (type?: 'notification' | 'earthquake' | 'tsunami') => Promise<void>;
  showBroadcastAlert: (alert: BroadcastAlert) => void;
  dismissBroadcastAlert: () => void;
}

const PushNotificationsContext = createContext<PushNotificationsContextType | undefined>(undefined);

type BroadcastAlert = {
  type: 'earthquake' | 'tsunami';
  title: string;
  body: string;
  createdAt?: string | null;
};

export const usePushNotifications = () => {
  const context = useContext(PushNotificationsContext);
  if (!context) {
    throw new Error('usePushNotifications must be used within a PushNotificationsProvider');
  }
  return context;
};

async function saveSubscription(subscription: PushSubscription | Token) {
  try {
    await fetch('/api/save-push-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subscription, platform: Capacitor.getPlatform() }),
    });
  } catch (error) {
    console.error('Failed to save push subscription:', error);
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const PushNotificationsProvider = ({ children }: { children: React.ReactNode }) => {
  const [permissionStatus, setPermissionStatus] = useState<PushNotificationsContextType['permissionStatus']>('prompt');
  const requestAttemptedRef = useRef(false);
  const [activeBroadcastAlert, setActiveBroadcastAlert] = useState<BroadcastAlert | null>(null);
  const alertOverlayDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userAlertAudioRef = useRef<HTMLAudioElement | null>(null);
  const alertSoundPathsRef = useRef<{ notification: string | null; earthquake: string | null; tsunami: string | null }>({
    notification: null,
    earthquake: null,
    tsunami: null,
  });
  const [userNotificationSoundPath, setUserNotificationSoundPath] = useState<string | null>(null);
  const [userEarthquakeSoundPath, setUserEarthquakeSoundPath] = useState<string | null>(null);
  const [userTsunamiSoundPath, setUserTsunamiSoundPath] = useState<string | null>(null);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const nativeListenersRef = useRef<PluginListenerHandle[]>([]);
  const [pushEligibility, setPushEligibility] = useState<'pending' | 'enabled' | 'disabled'>('pending');
  const overlayAllowed = pushEligibility !== 'disabled';
  const pushPermissionAllowed = pushEligibility === 'enabled';

  useEffect(() => {
    let isMounted = true;

    const resolveEligibility = async (userId?: string | null) => {
      if (!userId) {
        if (isMounted) setPushEligibility('pending');
        return;
      }
      try {
        const { data: profile, error } = await supabase
          .from('users')
          .select('user_type')
          .eq('id', userId)
          .single();
        if (!isMounted) return;
        if (error || !profile || profile.user_type !== 'user') {
          setPushEligibility('disabled');
        } else {
          setPushEligibility('enabled');
        }
      } catch {
        if (isMounted) setPushEligibility('pending');
      }
    };

    supabase.auth
      .getSession()
      .then(({ data }) => {
        void resolveEligibility(data?.session?.user?.id);
      })
      .catch(() => {
        if (isMounted) setPushEligibility('disabled');
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      void resolveEligibility(session?.user?.id);
    });

    return () => {
      isMounted = false;
      try { authListener?.subscription?.unsubscribe?.(); } catch {}
    };
  }, []);

  const registerForPushNotifications = useCallback(async () => {
    if (!pushPermissionAllowed) {
      return;
    }
    if (Capacitor.isNativePlatform()) {
      await PushNotifications.register();
    } else if ('serviceWorker' in navigator && 'PushManager' in window) {
      if (!VAPID_PUBLIC_KEY) {
        console.error('VAPID public key is not configured.');
        return;
      }

      const swRegistration = await navigator.serviceWorker.ready;
      const existing = await swRegistration.pushManager.getSubscription();
      if (existing) {
        await saveSubscription(existing);
        return;
      }
      const subscription = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      await saveSubscription(subscription);
    }
  }, [pushPermissionAllowed]);

  const requestPermission = useCallback(async () => {
    if (!pushPermissionAllowed) {
      return;
    }
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await PushNotifications.requestPermissions();
        setPermissionStatus(result.receive as PushNotificationsContextType['permissionStatus']);
        if (result.receive === 'granted') {
          await registerForPushNotifications();
        }
      } else if ('Notification' in window) {
        const permission = await window.Notification.requestPermission();
        setPermissionStatus(permission as PushNotificationsContextType['permissionStatus']);
        if (permission === 'granted') {
          await registerForPushNotifications();
        }
      }
    } catch (error) {
      console.error('Push notification permission error.', error);
    }
  }, [pushPermissionAllowed, registerForPushNotifications]);

  const loadUserAlertSettings = useCallback(async () => {
    if (!overlayAllowed) {
      return;
    }
    try {
      const { data, error } = await supabase
        .from('alert_settings')
        .select('user_notification_sound_path, user_earthquake_sound_path, user_tsunami_sound_path')
        .order('updated_at', { ascending: false })
        .limit(1);
      if (!error && data && data.length > 0) {
        const row = data[0] as any;
        const nextNotification = row.user_notification_sound_path || null;
        const nextEarthquake = row.user_earthquake_sound_path || null;
        const nextTsunami = row.user_tsunami_sound_path || null;

        alertSoundPathsRef.current = {
          notification: nextNotification,
          earthquake: nextEarthquake,
          tsunami: nextTsunami,
        };

        setUserNotificationSoundPath(prev => {
          if (prev && prev !== nextNotification) clearAlertSoundCache(prev);
          return nextNotification;
        });
        setUserEarthquakeSoundPath(prev => {
          if (prev && prev !== nextEarthquake) clearAlertSoundCache(prev);
          return nextEarthquake;
        });
        setUserTsunamiSoundPath(prev => {
          if (prev && prev !== nextTsunami) clearAlertSoundCache(prev);
          return nextTsunami;
        });
      }
    } catch (error) {
      console.warn('[PushProvider] Failed to load user alert settings', error);
    }
  }, [overlayAllowed]);

  const playAlertSound = useCallback(async (type: 'notification' | 'earthquake' | 'tsunami' = 'notification') => {
    if (!overlayAllowed) {
      return;
    }
    try {
      if (!userAlertAudioRef.current) {
        userAlertAudioRef.current = new Audio();
        userAlertAudioRef.current.loop = false;
        userAlertAudioRef.current.volume = 1.0;
      }

      const pickPath = () => {
        if (type === 'earthquake') return alertSoundPathsRef.current.earthquake ?? userEarthquakeSoundPath;
        if (type === 'tsunami') return alertSoundPathsRef.current.tsunami ?? userTsunamiSoundPath;
        return alertSoundPathsRef.current.notification ?? userNotificationSoundPath;
      };

      let path = pickPath();
      if (!path) {
        await loadUserAlertSettings();
        path = pickPath();
      }

      if (!path) {
        console.warn('[PushProvider] No sound path found for alert type', type);
        return;
      }

      const signed = await getAlertSoundSignedUrl(path, 120);
      if (!signed) {
        console.warn('[PushProvider] No signed URL for alert sound', { path, type });
        return;
      }

      userAlertAudioRef.current.src = signed;
      userAlertAudioRef.current.currentTime = 0;
      await userAlertAudioRef.current.play().catch(err => {
        console.warn('[PushProvider] Audio playback blocked', err);
      });
    } catch (error) {
      console.warn('[PushProvider] playAlertSound error', error);
    }
  }, [loadUserAlertSettings, overlayAllowed, userNotificationSoundPath, userEarthquakeSoundPath, userTsunamiSoundPath]);

  const dismissBroadcastAlert = useCallback(() => {
    if (alertOverlayDismissTimer.current) {
      clearTimeout(alertOverlayDismissTimer.current);
      alertOverlayDismissTimer.current = null;
    }
    setActiveBroadcastAlert(null);
  }, []);

  const showBroadcastAlert = useCallback(async (alert: BroadcastAlert, autoDismissMs = BROADCAST_OVERLAY_DURATION_MS) => {
    if (!overlayAllowed) {
      return;
    }
    setActiveBroadcastAlert(alert);
    if (alertOverlayDismissTimer.current) {
      clearTimeout(alertOverlayDismissTimer.current);
    }
    alertOverlayDismissTimer.current = setTimeout(() => {
      dismissBroadcastAlert();
    }, autoDismissMs);
    await playAlertSound(BROADCAST_SOUND_VARIANT);
  }, [dismissBroadcastAlert, overlayAllowed, playAlertSound]);

  const setupRealtime = useCallback(() => {
    if (!overlayAllowed) {
      return;
    }
    if (realtimeChannelRef.current) {
      return;
    }

    const channel = supabase
      .channel('push-provider-broadcasts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'broadcast_alerts' }, payload => {
        const type = String(payload?.new?.type || '').toLowerCase();
        if (type === 'earthquake' || type === 'tsunami') {
          const alert: BroadcastAlert = {
            type: type as 'earthquake' | 'tsunami',
            title: payload?.new?.title || (type === 'earthquake' ? 'Earthquake Alert' : 'Tsunami Alert'),
            body: payload?.new?.body || '',
            createdAt: payload?.new?.created_at || null,
          };
          void showBroadcastAlert(alert);
        }
      })
      .subscribe();

    realtimeChannelRef.current = channel;

    const settingsChannel = supabase
      .channel('push-provider-alert-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alert_settings' }, () => {
        void loadUserAlertSettings();
      })
      .subscribe();

    return () => {
      try {
        if (channel) supabase.removeChannel(channel);
        if (settingsChannel) supabase.removeChannel(settingsChannel);
      } catch {}
      realtimeChannelRef.current = null;
    };
  }, [loadUserAlertSettings, overlayAllowed, showBroadcastAlert]);

  const clearRealtime = useCallback(() => {
    if (realtimeChannelRef.current) {
      try { supabase.removeChannel(realtimeChannelRef.current); } catch {}
      realtimeChannelRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!overlayAllowed) {
      clearRealtime();
      return;
    }
    void loadUserAlertSettings();
    const cleanup = setupRealtime();
    return () => {
      clearRealtime();
      if (cleanup) cleanup();
    };
  }, [clearRealtime, loadUserAlertSettings, overlayAllowed, setupRealtime]);

  useEffect(() => {
    if (!overlayAllowed) {
      dismissBroadcastAlert();
    }
  }, [dismissBroadcastAlert, overlayAllowed]);

  useEffect(() => {
    if (!overlayAllowed) {
      return;
    }
    let gestureHandler: ((e?: any) => void) | null = null;

    const checkPermissionOnly = async () => {
      let initialStatus: string = 'prompt';
      try {
        if (Capacitor.isNativePlatform()) {
          initialStatus = (await PushNotifications.checkPermissions()).receive;
        } else if ('permissions' in navigator && typeof navigator.permissions?.query === 'function') {
          try {
            const result = await navigator.permissions.query({ name: 'notifications' as PermissionName });
            initialStatus = result.state;
            result.onchange = () => setPermissionStatus(result.state as PushNotificationsContextType['permissionStatus']);
          } catch {
            if ('Notification' in window) {
              initialStatus = window.Notification.permission;
            }
          }
        } else if ('Notification' in window) {
          initialStatus = window.Notification.permission;
        }
      } catch {}

      const normalized = (initialStatus === 'default' ? 'prompt' : initialStatus) as PushNotificationsContextType['permissionStatus'];
      setPermissionStatus(normalized);

      try {
        if (normalized === 'prompt') {
          if (Capacitor.isNativePlatform()) {
            if (!requestAttemptedRef.current) {
              requestAttemptedRef.current = true;
              await (async () => { try { await PushNotifications.requestPermissions(); } catch {} })();
              const after = (await PushNotifications.checkPermissions()).receive as PushNotificationsContextType['permissionStatus'];
              setPermissionStatus(after);
              if (after === 'granted') { await registerForPushNotifications(); }
            }
          } else {
            if (!requestAttemptedRef.current) {
              requestAttemptedRef.current = true;
              try {
                const permission = await window.Notification.requestPermission();
                const normalizedAfter = (permission === 'default' ? 'prompt' : permission) as PushNotificationsContextType['permissionStatus'];
                setPermissionStatus(normalizedAfter);
                if (normalizedAfter === 'granted') {
                  await registerForPushNotifications();
                }
              } catch {}
            }
            if (permissionStatus !== 'granted') {
              gestureHandler = async () => {
                try {
                  const permission = await window.Notification.requestPermission();
                  const normalizedAfter = (permission === 'default' ? 'prompt' : permission) as PushNotificationsContextType['permissionStatus'];
                  setPermissionStatus(normalizedAfter);
                  if (normalizedAfter === 'granted') {
                    await registerForPushNotifications();
                  }
                } catch {}
              };
              window.addEventListener('click', gestureHandler, { once: true });
              window.addEventListener('touchend', gestureHandler, { once: true });
              window.addEventListener('keydown', gestureHandler, { once: true });
            }
          }
        }
      } catch {}
    };

    void checkPermissionOnly();

    if (Capacitor.isNativePlatform()) {
      const attachNativeListeners = async () => {
        try {
          const existing = nativeListenersRef.current;
          if (existing.length) {
            await Promise.all(existing.map(listener => listener.remove?.().catch(() => {})));
            nativeListenersRef.current = [];
          }

          nativeListenersRef.current.push(
            await PushNotifications.addListener('registration', (token: Token) => {
              saveSubscription(token);
            })
          );

          nativeListenersRef.current.push(
            await PushNotifications.addListener('registrationError', (error: any) => {
              console.error('Error registering for push notifications', error);
            })
          );

          nativeListenersRef.current.push(
            await PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
              try {
                const data = notification?.data || {};
                const type = String(data?.type || '').toLowerCase();
                if (type === 'earthquake' || type === 'tsunami') {
                  const alert: BroadcastAlert = {
                    type: type as 'earthquake' | 'tsunami',
                    title: notification?.title || (type === 'earthquake' ? 'Earthquake Alert' : 'Tsunami Alert'),
                    body: notification?.body || '',
                    createdAt: new Date().toISOString(),
                  };
                  void showBroadcastAlert(alert);
                } else if (type === 'notification') {
                  void playAlertSound('notification');
                }
              } catch (error) {
                console.warn('[PushProvider] pushNotificationReceived handler error', error);
              }
            })
          );

          nativeListenersRef.current.push(
            await PushNotifications.addListener('pushNotificationActionPerformed', (notification: any) => {
              try {
                const data = notification?.notification?.data || {};
                const type = String(data?.type || '').toLowerCase();
                if (type === 'earthquake' || type === 'tsunami') {
                  const alert: BroadcastAlert = {
                    type: type as 'earthquake' | 'tsunami',
                    title: notification?.notification?.title || (type === 'earthquake' ? 'Earthquake Alert' : 'Tsunami Alert'),
                    body: notification?.notification?.body || '',
                    createdAt: new Date().toISOString(),
                  };
                  void showBroadcastAlert(alert);
                }
                const url = data?.url || data?.link;
                if (typeof url === 'string' && url.length > 0) {
                  window.location.href = url;
                }
              } catch (error) {
                console.warn('[PushProvider] pushNotificationActionPerformed handler error', error);
              }
            })
          );
        } catch (error) {
          console.warn('[PushProvider] Failed to attach native push listeners', error);
        }
      };

      void attachNativeListeners();
    }

    return () => {
      if (gestureHandler) {
        try { window.removeEventListener('click', gestureHandler as any); } catch {}
        try { window.removeEventListener('touchend', gestureHandler as any); } catch {}
        try { window.removeEventListener('keydown', gestureHandler as any); } catch {}
      }
      if (nativeListenersRef.current.length) {
        const listeners = [...nativeListenersRef.current];
        nativeListenersRef.current = [];
        listeners.forEach(listener => {
          try { listener.remove?.(); } catch {}
        });
      }
    };
  }, [overlayAllowed, permissionStatus, registerForPushNotifications, showBroadcastAlert, playAlertSound]);

  useEffect(() => {
    return () => {
      if (alertOverlayDismissTimer.current) {
        clearTimeout(alertOverlayDismissTimer.current);
        alertOverlayDismissTimer.current = null;
      }
      if (userAlertAudioRef.current) {
        try {
          userAlertAudioRef.current.pause();
        } catch {}
      }
    };
  }, []);

  const contextValue = useMemo(() => ({
    requestPermission,
    permissionStatus,
    playAlertSound,
    showBroadcastAlert,
    dismissBroadcastAlert,
  }), [requestPermission, permissionStatus, playAlertSound, showBroadcastAlert, dismissBroadcastAlert]);

  return (
    <PushNotificationsContext.Provider value={contextValue}>
      {activeBroadcastAlert && (
        <UserBroadcastOverlay
          alert={activeBroadcastAlert}
          onDismiss={dismissBroadcastAlert}
          onPlaySound={() => { if (activeBroadcastAlert) { void playAlertSound(BROADCAST_SOUND_VARIANT); } }}
        />
      )}
      {children}
    </PushNotificationsContext.Provider>
  );
};

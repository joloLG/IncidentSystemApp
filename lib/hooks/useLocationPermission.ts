"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

export interface LocationCoordinates {
  lat: number;
  lng: number;
}

interface UseLocationPermissionOptions {
  userId?: string | null;
  storageKeyOverride?: string;
}

interface UseLocationPermissionResult {
  location: LocationCoordinates | null;
  locationError: string | null;
  showLocationModal: boolean;
  setShowLocationModal: (open: boolean) => void;
  ensureLocationReady: () => Promise<boolean>;
  requestPermission: () => Promise<boolean>;
  getFreshLocation: (timeoutMs?: number) => Promise<LocationCoordinates | null>;
  updateLocation: (coords: LocationCoordinates | null) => void;
  hasPermission: boolean;
  isNativePlatform: boolean;
}

type GeolocationErrorCode = "location_denied" | "location_unavailable" | "location_timeout" | "not_supported" | "location_services_disabled" | "location_error" | null;

const GEO_TIMEOUT_MS = 15000;

export function useLocationPermission(
  options: UseLocationPermissionOptions = {}
): UseLocationPermissionResult {
  const { userId, storageKeyOverride } = options;

  const storageKey = useMemo(() => {
    if (storageKeyOverride) return storageKeyOverride;
    return userId ? `mdrrmo_${userId}_location_permission` : "mdrrmo_location_permission";
  }, [userId, storageKeyOverride]);

  const isNativePlatform = useMemo(() => Capacitor.isNativePlatform(), []);

  const readPersistedPermission = useCallback((): boolean => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(storageKey) === "granted";
    } catch {
      return false;
    }
  }, [storageKey]);

  const [hasPermission, setHasPermission] = useState<boolean>(readPersistedPermission());
  const [location, setLocation] = useState<LocationCoordinates | null>(null);
  const [locationError, setLocationError] = useState<GeolocationErrorCode>(null);
  const [showLocationModal, setShowLocationModal] = useState<boolean>(!readPersistedPermission());

  const locationPermissionGrantedRef = useRef<boolean>(hasPermission);
  const locationWatchIdRef = useRef<string | number | null>(null);
  const permissionChangeCleanupRef = useRef<(() => void) | null>(null);

  const persistPermissionGranted = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(storageKey, "granted");
    } catch (error) {
      console.warn("Unable to persist location permission grant", error);
    }
  }, [storageKey]);

  const clearPersistedPermission = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  }, [storageKey]);

  const markPermissionGranted = useCallback(() => {
    locationPermissionGrantedRef.current = true;
    setHasPermission(true);
    persistPermissionGranted();
    setLocationError(null);
    setShowLocationModal(false);
  }, [persistPermissionGranted]);

  const stopLocationWatch = useCallback(() => {
    if (locationWatchIdRef.current == null) return;
    if (isNativePlatform) {
      Geolocation.clearWatch({ id: locationWatchIdRef.current as string }).catch(() => {});
    } else if (typeof navigator !== "undefined" && navigator.geolocation?.clearWatch) {
      navigator.geolocation.clearWatch(locationWatchIdRef.current as number);
    }
    locationWatchIdRef.current = null;
  }, [isNativePlatform]);

  const markPermissionLost = useCallback(
    (errorKey: GeolocationErrorCode, showModal = true) => {
      locationPermissionGrantedRef.current = false;
      setHasPermission(false);
      clearPersistedPermission();
      setLocation(null);
      setLocationError(errorKey);
      if (showModal) {
        setShowLocationModal(true);
      }
      stopLocationWatch();
    },
    [clearPersistedPermission, stopLocationWatch]
  );

  const startLocationWatch = useCallback(() => {
    if (locationWatchIdRef.current != null) return;
    if (isNativePlatform) {
      Geolocation.watchPosition({ enableHighAccuracy: true, maximumAge: 1000 }, (position, err) => {
        if (err) {
          console.warn("Native geolocation watch error:", err);
          markPermissionLost("location_error", true);
          return;
        }
        if (position?.coords) {
          setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
          setLocationError(null);
          markPermissionGranted();
        }
      })
        .then(id => {
          locationWatchIdRef.current = id;
        })
        .catch(error => {
          console.warn("Failed to start native geolocation watch:", error);
        });
    } else if (typeof navigator !== "undefined" && navigator.geolocation?.watchPosition) {
      const watchId = navigator.geolocation.watchPosition(
        pos => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationError(null);
          markPermissionGranted();
        },
        err => {
          console.warn("Browser geolocation watch error:", err);
          if (err.code === err.PERMISSION_DENIED) {
            markPermissionLost("location_denied");
          } else if (err.code === err.TIMEOUT) {
            setLocationError("location_timeout");
          } else {
            setLocationError("location_error");
          }
        },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
      );
      locationWatchIdRef.current = watchId;
    }
  }, [isNativePlatform, markPermissionGranted, markPermissionLost]);

  const getBrowserPosition = useCallback(
    (timeoutMs: number) =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        if (typeof navigator === "undefined" || !navigator.geolocation) {
          reject(Object.assign(new Error("Geolocation unsupported"), { code: 0 }));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: timeoutMs,
          maximumAge: 0,
        });
      }),
    []
  );

  const getFreshLocation = useCallback(
    async (timeoutMs: number = GEO_TIMEOUT_MS): Promise<LocationCoordinates | null> => {
      try {
        if (isNativePlatform) {
          const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: timeoutMs });
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocation(coords);
          setLocationError(null);
          markPermissionGranted();
          return coords;
        }

        const pos = await getBrowserPosition(timeoutMs);
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(coords);
        setLocationError(null);
        markPermissionGranted();
        return coords;
      } catch (error: any) {
        console.error("Error getting location:", error);
        if (error?.code === error?.PERMISSION_DENIED || error?.code === 1) {
          markPermissionLost("location_denied");
        } else if (error?.code === error?.POSITION_UNAVAILABLE || error?.code === 2) {
          setLocationError("location_unavailable");
        } else if (error?.code === error?.TIMEOUT || error?.code === 3) {
          setLocationError("location_timeout");
        } else if (typeof error?.message === "string" && error.message.toLowerCase().includes("services are not enabled")) {
          markPermissionLost("location_services_disabled");
        } else {
          setLocationError("location_error");
        }
        return null;
      }
    },
    [getBrowserPosition, isNativePlatform, markPermissionGranted, markPermissionLost]
  );

  const checkLocationPermission = useCallback(async (): Promise<boolean> => {
    if (isNativePlatform) {
      try {
        const permission = await Geolocation.checkPermissions();
        if (permission.location === "granted") {
          markPermissionGranted();
          startLocationWatch();
          await getFreshLocation();
          return true;
        }
        const requestResult = await Geolocation.requestPermissions();
        if (requestResult.location === "granted") {
          markPermissionGranted();
          startLocationWatch();
          await getFreshLocation();
          return true;
        }
        markPermissionLost("location_denied");
        return false;
      } catch (error: any) {
        console.error("Capacitor geolocation error:", error);
        if (typeof error?.message === "string" && error.message.toLowerCase().includes("needs to be enabled")) {
          markPermissionLost("location_services_disabled");
        } else {
          markPermissionLost("location_error");
        }
        return false;
      }
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      markPermissionLost("not_supported");
      return false;
    }

    try {
      await getFreshLocation();
      startLocationWatch();
      return true;
    } catch {
      return false;
    }
  }, [getFreshLocation, isNativePlatform, markPermissionGranted, markPermissionLost, startLocationWatch]);

  const ensureLocationReady = useCallback(async () => {
    if (locationPermissionGrantedRef.current) {
      startLocationWatch();
      return true;
    }
    return checkLocationPermission();
  }, [checkLocationPermission, startLocationWatch]);

  const requestPermission = useCallback(async () => {
    if (isNativePlatform) {
      return checkLocationPermission();
    }

    if (typeof navigator === "undefined" || !(navigator as any).permissions) {
      return checkLocationPermission();
    }

    try {
      const permissionStatus = await (navigator as any).permissions.query({ name: "geolocation" as PermissionName });

      const handlePermissionChange = () => {
        if (permissionStatus.state === "granted") {
          void checkLocationPermission();
        } else if (permissionStatus.state === "denied") {
          markPermissionLost("location_denied");
        }
      };

      permissionStatus.onchange = handlePermissionChange as any;
      permissionChangeCleanupRef.current = () => {
        permissionStatus.onchange = null;
      };

      if (permissionStatus.state === "granted") {
        return checkLocationPermission();
      }

      if (permissionStatus.state === "prompt") {
        setShowLocationModal(true);
        const granted = await checkLocationPermission();
        if (!granted) {
          setShowLocationModal(true);
        }
        return granted;
      }

      markPermissionLost("location_denied");
      return false;
    } catch (error) {
      console.error("Error checking location permission:", error);
      setShowLocationModal(true);
      return checkLocationPermission();
    }
  }, [checkLocationPermission, isNativePlatform, markPermissionLost]);

  const updateLocation = useCallback((coords: LocationCoordinates | null) => {
    setLocation(coords);
  }, []);

  useEffect(() => {
    return () => {
      stopLocationWatch();
      permissionChangeCleanupRef.current?.();
    };
  }, [stopLocationWatch]);

  useEffect(() => {
    if (locationPermissionGrantedRef.current) {
      void ensureLocationReady();
    }
  }, [ensureLocationReady]);

  useEffect(() => {
    const persisted = readPersistedPermission();
    locationPermissionGrantedRef.current = persisted;
    if (persisted) {
      setHasPermission(true);
      setShowLocationModal(false);
    }
  }, [readPersistedPermission]);

  return {
    location,
    locationError,
    showLocationModal,
    setShowLocationModal,
    ensureLocationReady,
    requestPermission,
    getFreshLocation,
    updateLocation,
    hasPermission,
    isNativePlatform,
  };
}

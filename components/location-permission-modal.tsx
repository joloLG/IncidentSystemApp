"use client";

import { useEffect, useState } from "react";
import { AlertCircle, MapPin, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

interface LocationPermissionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestPermission: () => Promise<boolean>;
  error?: string | null;
}

export function LocationPermissionModal({
  open,
  onOpenChange,
  onRequestPermission,
  error,
}: LocationPermissionModalProps) {
  const [isChecking, setIsChecking] = useState(true);

  const errorMessages: Record<string, string> = {
    location_denied: "You have denied location access. Please enable it in your settings.",
    location_unavailable: "Unable to retrieve your location. Please check your connection.",
    location_timeout: "Location request timed out. GPS signals can be slow indoors or with poor connection. Please try again in an open area.",
    not_supported: "Geolocation is not supported by your browser.",
    location_services_disabled: "Your device's location services (GPS) are turned off. Please enable Location in your device settings.",
    location_error: "An unexpected error occurred while accessing your location. Please try again.",
  };

  const errorMessage = error ? errorMessages[error] ?? "Location access is required." : null;

  useEffect(() => {
    if (error) {
      setIsChecking(false);
      return;
    }

    const checkPermission = async () => {
      try {
        // Only use the browser Permissions API on the web
        if (typeof window !== "undefined" && !Capacitor.isNativePlatform() && (navigator as any).permissions) {
          const permissionStatus = await (navigator as any).permissions.query({ name: "geolocation" as PermissionName });

          const handlePermissionChange = () => {
            if (permissionStatus.state === "denied") {
              onOpenChange(true);
            } else if (permissionStatus.state === "granted") {
              onOpenChange(false);
              void onRequestPermission();
            }
          };

          handlePermissionChange();
          permissionStatus.onchange = handlePermissionChange as any;

          return () => {
            permissionStatus.onchange = null as any;
          };
        }
      } catch (e) {
        console.error("Error checking geolocation permission:", e);
      } finally {
        setIsChecking(false);
      }
    };

    checkPermission();
  }, [error, onOpenChange, onRequestPermission]);

  const handleEnableLocation = async () => {
    setIsChecking(true);
    try {
      const granted = await onRequestPermission();
      if (granted) onOpenChange(false);
    } finally {
      setIsChecking(false);
    }
  };
  if (isChecking) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            <p className="text-gray-700">Checking location settings...</p>
          </div>
        </div>
      </div>
    );
  }

  const openSettings = async () => {
    if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
      const platform = Capacitor.getPlatform();
      try {
        if (platform === "ios" && typeof (App as any).openUrl === "function") {
          // iOS supports the special app-settings: URL scheme
          await (App as any).openUrl({ url: "app-settings:" });
          void onRequestPermission();
          return;
        }
      } catch (e) {
        console.warn("Unable to open system settings automatically.", e);
      }

      const instructions = platform === "android"
        ? "Please open Settings > Apps > MDRRMO App > Permissions, then enable Location."
        : "Please open iOS Settings > Privacy & Security > Location Services, locate MDRRMO App, and set permission to 'While Using the App'.";
      alert(instructions);
      return;
    }

    const message = error === "location_denied"
      ? "Please enable location access in your browser settings and refresh the page."
      : "Your browser will prompt you to allow location access. Please accept to continue.";
    alert(message);

    if (typeof window !== "undefined" && error !== "location_denied" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(() => {}, () => {}, { enableHighAccuracy: true });
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">
            {error ? "Location Access Required" : "Enable Location Services"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {error 
              ? "Location access is required to use emergency reporting features. Please enable location permissions in your device settings."
              : "This app requires location access to provide accurate emergency services and help responders locate you quickly."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="flex flex-col items-center text-center space-y-4">
          <div className="p-3 bg-red-50 rounded-full">
            <AlertCircle className="h-10 w-10 text-red-600" aria-hidden="true" />
          </div>

          <div className="space-y-4">
            {error ? (
              <div className="flex flex-col space-y-4 text-left">
                <div className="flex items-start space-x-2 text-red-600">
                  <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
                <div id="location-permission-description" className="text-gray-600">
                  To use all features of this app, please enable location services in your {Capacitor.isNativePlatform() ? "device" : "browser"} settings.
                </div>
              </div>
            ) : (
              <p className="text-gray-600">
                To provide accurate emergency services, we need access to your location.
              </p>
            )}
          </div>

          <div className="flex flex-col items-center space-y-4 w-full">
            <div className="bg-blue-50 p-4 rounded-lg w-full text-left">
              <div className="flex items-start space-x-3">
                <MapPin className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-blue-800">Why we need your location:</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1 text-blue-700 text-sm">
                    <li>Pinpoint your exact location during emergencies</li>
                    <li>Provide accurate directions to first responders</li>
                    <li>Show nearby emergency services</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                {error ? "Maybe Later" : "Not Now"}
              </Button>
              <Button
                onClick={() => {
                  if (error === "location_denied" || error === "location_services_disabled") {
                    void openSettings();
                  } else {
                    void handleEnableLocation();
                  }
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {error === "location_denied" || error === "location_services_disabled" ? "Open Settings" : "Enable Location"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

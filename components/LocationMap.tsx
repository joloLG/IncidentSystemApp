'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LocationMapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  className?: string;
}

// Create a simple red location marker
const createLocationIcon = () => {
  return L.divIcon({
    html: `
      <div style="
        width: 24px;
        height: 24px;
        background: #ff3d50;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 0 10px rgba(0,0,0,0.3);
        transform: translate(-50%, -50%);
      "></div>
    `,
    className: 'location-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

const LocationMap = ({ latitude, longitude, zoom = 15, className = '' }: LocationMapProps) => {
  const [mapInitialized, setMapInitialized] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const animationFrameRef = useRef<number>();
  const lastBounceTimeRef = useRef<number>(0);
  
  // Validate coordinates
  const isValidCoordinate = (coord: number) => 
    !isNaN(coord) && isFinite(coord) && Math.abs(coord) <= 180;
  
  if (!isValidCoordinate(latitude) || !isValidCoordinate(longitude)) {
    return (
      <div className={`h-64 w-full rounded-lg bg-gray-100 flex items-center justify-center ${className}`}>
        <p className="text-gray-500 text-center p-4">
          Invalid location coordinates
        </p>
      </div>
    );
  }

  useEffect(() => {
    console.log('useEffect running in LocationMap');
    // Only run on client-side
    if (typeof window === 'undefined') {
      console.log('Skipping map initialization on server side');
      return;
    }
    
    if (!mapContainerRef.current) {
      console.error('Map container ref is not available');
      return;
    }
    
    console.log('Initializing map with Leaflet version:', L.version);

    // Initialize the map
    mapRef.current = L.map(mapContainerRef.current, {
      center: [latitude, longitude],
      zoom: zoom,
      zoomControl: false,
    });

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(mapRef.current);

    // Add static red marker
    markerRef.current = L.marker([latitude, longitude], {
      icon: createLocationIcon(),
      title: 'Incident Location',
    }).addTo(mapRef.current);

    // No animation for static marker

    // Cleanup function
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [latitude, longitude, zoom]);

  if (mapError) {
    return (
      <div className={`h-64 w-full rounded-lg bg-gray-100 flex items-center justify-center ${className}`}>
        <p className="text-red-500 text-center p-4">
          Failed to load map: {mapError}
        </p>
      </div>
    );
  }

  return (
    <div className={`relative ${className || ''}`}>
      <div 
        ref={mapContainerRef} 
        className={`h-64 w-full rounded-lg overflow-hidden ${!mapInitialized ? 'bg-gray-100' : ''}`}
        style={{ zIndex: 1, minHeight: '200px' }}
      >
        {!mapInitialized && (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-500">Loading map...</p>
          </div>
        )}
      </div>
      {mapInitialized && (
        <div className="absolute bottom-2 right-2 flex gap-2">
          <a 
            href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}&zoom=15`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-white hover:bg-gray-50 text-gray-800 text-xs font-medium px-3 py-1.5 rounded shadow-sm border border-gray-300 flex items-center"
          >
            <span>Open in OSM</span>
          </a>
          <a 
            href={`https://www.google.com/maps?q=${latitude},${longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white hover:bg-gray-50 text-gray-800 text-xs font-medium px-3 py-1.5 rounded shadow-sm border border-gray-300 flex items-center"
          >
            <span>Open in Google Maps</span>
          </a>
        </div>
      )}
    </div>
  );
};

export default LocationMap;

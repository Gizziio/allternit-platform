'use client';

import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export interface MapMarker {
  lat: number;
  lng: number;
  label?: string;
  popup?: string;
}

export interface MapArtifactProps {
  lat?: number;
  lng?: number;
  zoom?: number;
  markers?: MapMarker[];
  title?: string;
}

export function MapArtifact({ lat = 51.505, lng = -0.09, zoom = 13, markers = [], title }: MapArtifactProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let L: typeof import('leaflet');
    let map: import('leaflet').Map;

    import('leaflet').then((leaflet) => {
      L = leaflet.default ?? leaflet;

      // Fix default icon paths broken by bundlers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      map = L.map(containerRef.current!, { zoomControl: true }).setView([lat, lng], zoom);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      for (const marker of markers) {
        const m = L.marker([marker.lat, marker.lng]).addTo(map);
        if (marker.popup) {
          m.bindPopup(marker.popup);
        } else if (marker.label) {
          m.bindTooltip(marker.label, { permanent: true, direction: 'top' });
        }
      }

      if (markers.length > 1) {
        const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    });

    return () => {
      if (map) map.remove();
      mapRef.current = null;
    };
  // lat/lng/zoom/markers are serializable — safe to include
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.08)',
        background: '#1a1a1a',
      }}
    >
      {title && (
        <div style={{
          padding: '8px 14px',
          fontSize: 13,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.75)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          {title}
        </div>
      )}
      <div ref={containerRef} style={{ height: 340, width: '100%' }} />
    </div>
  );
}

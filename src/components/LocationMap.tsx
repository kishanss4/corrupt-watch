import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface LocationMapProps {
  onLocationSelect: (location: string, lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
  initialZoom?: number;
  externalLat?: number | null;
  externalLng?: number | null;
}

export function LocationMap({ 
  onLocationSelect, 
  initialLat = 28.6139, 
  initialLng = 77.2090, 
  initialZoom = 12,
  externalLat,
  externalLng
}: LocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current).setView([initialLat, initialLng], initialZoom);
    mapInstanceRef.current = map;

    // Add OpenStreetMap tiles (free and open source)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Add click handler to place marker
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;

      // Remove existing marker if any
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
      }

      // Add new marker
      markerRef.current = L.marker([lat, lng]).addTo(map);

      // Reverse geocode using Nominatim (OpenStreetMap's free geocoding service)
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
        );
        const data = await response.json();
        const locationName = data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        
        markerRef.current.bindPopup(locationName).openPopup();
        onLocationSelect(locationName, lat, lng);
      } catch (error) {
        console.error('Geocoding error:', error);
        const locationName = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        markerRef.current.bindPopup(locationName).openPopup();
        onLocationSelect(locationName, lat, lng);
      }
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [initialLat, initialLng, initialZoom, onLocationSelect]);

  // Handle external coordinates (from text input geocoding)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || externalLat === null || externalLng === null || externalLat === undefined || externalLng === undefined) return;

    // Remove existing marker if any
    if (markerRef.current) {
      map.removeLayer(markerRef.current);
    }

    // Add new marker at external coordinates
    markerRef.current = L.marker([externalLat, externalLng]).addTo(map);
    
    // Center map on the marker
    map.setView([externalLat, externalLng], 13);

    // Add popup
    markerRef.current.bindPopup(`${externalLat.toFixed(6)}, ${externalLng.toFixed(6)}`).openPopup();
  }, [externalLat, externalLng]);

  return (
    <div 
      ref={mapRef} 
      className="h-[400px] w-full rounded-lg border border-border shadow-sm"
    />
  );
}

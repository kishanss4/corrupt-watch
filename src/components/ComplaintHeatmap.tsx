import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Complaint {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  category: string;
  status: string;
}

interface ComplaintHeatmapProps {
  complaints: Complaint[];
}

export function ComplaintHeatmap({ complaints }: ComplaintHeatmapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current).setView([28.6139, 77.2090], 6);
    mapInstanceRef.current = map;

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    // Category colors
    const categoryColors: Record<string, string> = {
      bribery: '#ef4444',
      misconduct: '#f97316',
      misuse_of_funds: '#eab308',
      negligence: '#84cc16',
      infrastructure: '#3b82f6',
      other: '#8b5cf6',
    };

    // Add markers for each complaint with location
    const validComplaints = complaints.filter(c => c.latitude && c.longitude);
    
    if (validComplaints.length > 0) {
      const bounds = L.latLngBounds(
        validComplaints.map(c => [c.latitude, c.longitude])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });

      validComplaints.forEach((complaint) => {
        const color = categoryColors[complaint.category] || '#6b7280';
        
        const icon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="
            background-color: ${color};
            width: 12px;
            height: 12px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          "></div>`,
          iconSize: [12, 12],
        });

        const marker = L.marker([complaint.latitude, complaint.longitude], { icon })
          .addTo(map)
          .bindPopup(`
            <div style="min-width: 200px;">
              <strong>${complaint.title}</strong><br/>
              <span style="color: ${color}; text-transform: capitalize;">
                ${complaint.category.replace('_', ' ')}
              </span><br/>
              <span style="text-transform: capitalize;">Status: ${complaint.status}</span>
            </div>
          `);
      });
    }
  }, [complaints]);

  return (
    <div 
      ref={mapRef} 
      className="h-[500px] w-full rounded-lg border border-border shadow-sm"
    />
  );
}

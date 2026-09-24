'use client';
import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Place } from '@/lib/places';

function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lon], 15); }, [lat, lon, map]);
  return null;
}

export default function StayMap({ center, places, counts, me, onSelect }: {
  center: { lat: number; lon: number }; places: Place[]; counts: Record<string, number>;
  me?: { lat: number; lon: number } | null; onSelect: (p: Place) => void;
}) {
  return (
    <MapContainer center={[center.lat, center.lon]} zoom={15} className="map" scrollWheelZoom={false} attributionControl>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
      <Recenter lat={center.lat} lon={center.lon} />
      {me && <CircleMarker center={[me.lat, me.lon]} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}>
        <Tooltip>אתה כאן</Tooltip></CircleMarker>}
      {places.map(p => {
        const n = counts[p.id] ?? 0;
        return <CircleMarker key={p.id} center={[p.lat, p.lon]} radius={n ? 10 : 7}
          pathOptions={{ color: '#fff', weight: 2, fillColor: n ? '#2f7d6d' : '#1f1a17', fillOpacity: 0.9 }}
          eventHandlers={{ click: () => onSelect(p) }}>
          <Tooltip direction="top">{p.name}{n ? ` · ${n} דיווחים` : ''}</Tooltip>
        </CircleMarker>;
      })}
    </MapContainer>
  );
}

'use client';
import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Place } from '@/lib/places';

function Recenter({ lat, lon, zoom }: { lat: number; lon: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    const c = map.getCenter();
    const far = map.distance(c, [lat, lon]) > 30000;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Nearby moves glide like Apple Maps; long jumps cut straight there.
    if (far || reduce) map.setView([lat, lon], zoom, { animate: false });
    else map.flyTo([lat, lon], zoom, { duration: 0.8, easeLinearity: 0.2 });
  }, [lat, lon, zoom, map]);
  return null;
}

export default function StayMap({ center, places, counts, me, onSelect }: {
  center: { lat: number; lon: number }; places: Place[]; counts: Record<string, number>;
  me?: { lat: number; lon: number } | null; onSelect: (p: Place) => void;
}) {
  // Around the user's own position, open closer in (street level); for a searched town, a little wider.
  const nearMe = !!me && Math.abs(me.lat - center.lat) < 0.005 && Math.abs(me.lon - center.lon) < 0.005;
  const zoom = nearMe ? 16 : 15;
  return (
    <MapContainer center={[center.lat, center.lon]} zoom={zoom} className="map" scrollWheelZoom={false} attributionControl>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} keepBuffer={1} updateWhenZooming={false}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
      <Recenter lat={center.lat} lon={center.lon} zoom={zoom} />
      {me && <CircleMarker center={[me.lat, me.lon]} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}>
        <Tooltip>אתה כאן</Tooltip></CircleMarker>}
      {places.map(p => {
        const n = counts[p.id] ?? 0;
        // Places with reports get a teal pill with the count; the rest are small quiet dots.
        const icon = n
          ? L.divIcon({ className: 'pin-wrap', html: `<span class="pin known">${n}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] })
          : L.divIcon({ className: 'pin-wrap', html: '<span class="pin"></span>', iconSize: [16, 16], iconAnchor: [8, 8] });
        return <Marker key={p.id} position={[p.lat, p.lon]} icon={icon} zIndexOffset={n ? 500 : 0} eventHandlers={{ click: () => onSelect(p) }}>
          <Tooltip direction="top" offset={[0, -10]}>{p.name}{n ? ` · ${n === 1 ? 'דיווח 1' : `${n} דיווחים`}` : ''}</Tooltip>
        </Marker>;
      })}
    </MapContainer>
  );
}

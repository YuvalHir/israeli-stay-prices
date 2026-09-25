import type { Place } from './places';
import { visibleOfflinePrices, type OfflinePack } from './offlinePack';

/** Only read prices from an owner-bound, unexpired server-authorized snapshot. */
export function offlineNearby(packs: OfflinePack[], owner: string | null, lat: number, lon: number, now = Date.now(), radiusKm = 2) {
  const distance = (p: { lat: number; lon: number }) => {
    const r = Math.PI / 180, a = (p.lat - lat) * r, b = (p.lon - lon) * r;
    const h = Math.sin(a / 2) ** 2 + Math.cos(lat * r) * Math.cos(p.lat * r) * Math.sin(b / 2) ** 2;
    return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
  };
  const nearby = new Map<string, { place: Place; prices: OfflinePack['prices']; reports: number; expiresAt: number }>();
  if (!owner) return [];
  for (const pack of packs) {
    if (pack.owner !== owner || !Number.isFinite(pack.savedAt) || pack.savedAt > now || !Number.isFinite(pack.pricesExpireAt)) continue;
    const prices = visibleOfflinePrices(pack, now);
    for (const stop of pack.stops) for (const lodge of stop.lodges) {
      const d = distance(lodge);
      if (d > radiusKm) continue;
      const ownPrices = prices.filter(p => p.placeId === lodge.id);
      const old = nearby.get(lodge.id);
      if (!old || ownPrices.length > old.prices.length) nearby.set(lodge.id, {
        place: { id: lodge.id, name: lodge.name, kind: lodge.kind, lat: lodge.lat, lon: lodge.lon, country: lodge.country ?? 'NP', distance: d },
        prices: ownPrices, reports: lodge.reports, expiresAt: pack.pricesExpireAt,
      });
    }
  }
  return [...nearby.values()].sort((a, b) => (a.place.distance ?? 0) - (b.place.distance ?? 0));
}

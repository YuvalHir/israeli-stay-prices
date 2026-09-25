/** Conservative trekking corridors in Nepal. Keep this server-enforced for reports. */
const REGIONS = [
  { name: 'Everest / Khumbu', south: 27.55, north: 28.15, west: 86.45, east: 87.05 },
  { name: 'Annapurna', south: 28.3, north: 29.15, west: 83.4, east: 84.4 },
  { name: 'Langtang', south: 28.03, north: 28.4, west: 85.18, east: 85.9 },
  { name: 'Manaslu', south: 28.28, north: 28.95, west: 84.45, east: 85.2 },
] as const;

export function trekDealRegion(lat: number | null | undefined, lon: number | null | undefined): string | null {
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return REGIONS.find(r => lat >= r.south && lat <= r.north && lon >= r.west && lon <= r.east)?.name ?? null;
}

/** A filter matches one report, not two different reports from the same lodge. */
export function matchesRoomDeal(r: { beds: number | null; israeli_deal: number }, beds: number | null, deal: boolean) {
  return (beds == null || r.beds === beds) && (!deal || r.israeli_deal === 1);
}

/** Yale central campus approx. bounds — used to soft-limit “on campus” UX. */
export const YALE_CAMPUS = {
  center: { lat: 41.3111, lng: -72.9267 },
  /** ~1.6 miles — keeps New Haven core, excludes West Campus by default filter. */
  radiusMeters: 2600,
} as const;

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(meters: number | null): string {
  if (meters == null || Number.isNaN(meters)) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1609.344).toFixed(1)} mi`;
}

export function isLikelyOnCampus(point: { lat: number; lng: number }): boolean {
  return haversineMeters(point, YALE_CAMPUS.center) <= YALE_CAMPUS.radiusMeters;
}

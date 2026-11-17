/** Yale central campus approx. — default pin when GPS is unavailable. */
export const YALE_CAMPUS = {
  center: { lat: 41.3111, lng: -72.9267 },
  /** ~1.6 miles — keeps New Haven core, excludes West Campus by default filter. */
  radiusMeters: 2600,
} as const;

/**
 * Approximate New Haven city bbox for Leaflet maxBounds.
 * Keeps the map from zooming out to the whole world (fewer wasted tiles).
 */
export const NEW_HAVEN_BOUNDS = {
  southWest: { lat: 41.255, lng: -72.995 },
  northEast: { lat: 41.355, lng: -72.86 },
  minZoom: 12,
} as const;

/** Typical campus walk / crow-flies ratio when courtyards force slight detours. */
export const CAMPUS_WALK_FACTOR = 1.3;

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

/** Sum segment lengths along a lat/lng path (matches what’s drawn on the map). */
export function pathLengthMeters(
  coordinates: Array<{ lat: number; lng: number } | [number, number]>,
): number {
  if (coordinates.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < coordinates.length - 1; i += 1) {
    const a = coordinates[i];
    const b = coordinates[i + 1];
    const from = Array.isArray(a) ? { lat: a[0], lng: a[1] } : a;
    const to = Array.isArray(b) ? { lat: b[0], lng: b[1] } : b;
    total += haversineMeters(from, to);
  }
  return total;
}

export function estimateWalkMeters(straightMeters: number): number {
  return straightMeters * CAMPUS_WALK_FACTOR;
}

/** US-campus friendly: feet for short hops, miles after that. */
export function formatDistance(meters: number | null): string {
  if (meters == null || Number.isNaN(meters)) return "—";
  const feet = meters * 3.28084;
  if (feet < 1000) return `${Math.round(feet)} ft`;
  const miles = meters / 1609.344;
  return `${miles < 10 ? miles.toFixed(2) : miles.toFixed(1)} mi`;
}

export function isLikelyOnCampus(point: { lat: number; lng: number }): boolean {
  return haversineMeters(point, YALE_CAMPUS.center) <= YALE_CAMPUS.radiusMeters;
}

export function isInNewHaven(point: { lat: number; lng: number }): boolean {
  return (
    point.lat >= NEW_HAVEN_BOUNDS.southWest.lat &&
    point.lat <= NEW_HAVEN_BOUNDS.northEast.lat &&
    point.lng >= NEW_HAVEN_BOUNDS.southWest.lng &&
    point.lng <= NEW_HAVEN_BOUNDS.northEast.lng
  );
}

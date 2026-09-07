/**
 * Straight-line distance in km. Good enough to rank nearby shops for a
 * consumer; the app never claims to be a routing service.
 */
export function distanceKm(
  a: { latitude: number | null; longitude: number | null },
  b: { latitude: number | null; longitude: number | null }
): number | null {
  if (a.latitude === null || a.longitude === null || b.latitude === null || b.longitude === null) {
    return null;
  }
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}

export function formatDistance(km: number | null): string {
  if (km === null) return 'Distance unknown';
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km} km away`;
}

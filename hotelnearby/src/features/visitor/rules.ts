export function calculateAccommodationTotal(price: number | null, basis: string | null, nights: number): number | null {
  if (price === null || !Number.isFinite(price) || price < 0 || !["night", "day"].includes(basis ?? "")) return null;
  if (!Number.isInteger(nights) || nights < 1 || nights > 365) return null;
  return price * nights;
}
export function splitGroupCost(total: number, travellers: number): number | null {
  if (!Number.isFinite(total) || total < 0 || !Number.isInteger(travellers) || travellers < 1 || travellers > 100) return null;
  return total / travellers;
}
export function haversineDistanceKm(origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }): number | null {
  const valid = (p: { latitude: number; longitude: number }) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && p.latitude >= -90 && p.latitude <= 90 && p.longitude >= -180 && p.longitude <= 180;
  if (!valid(origin) || !valid(destination)) return null;
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(destination.latitude - origin.latitude), dLon = rad(destination.longitude - origin.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(origin.latitude)) * Math.cos(rad(destination.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
export function matchSuitability(required: string[], amenities: string[], features: string[]) {
  const known = new Set([...amenities, ...features]);
  return { matched: required.filter((item) => known.has(item)), notListed: required.filter((item) => !known.has(item)) };
}
export function compareLimitReached(currentCount: number): boolean { return currentCount >= 3; }

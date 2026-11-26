export function hasValidCoordinatePair(latitude: number | null | undefined, longitude: number | null | undefined): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude! >= -90 && latitude! <= 90
    && longitude! >= -180 && longitude! <= 180;
}

export function isEventCurrent(startsAt: string | Date, endsAt: string | Date | null | undefined, now = new Date()): boolean {
  const start = new Date(startsAt).getTime();
  const end = endsAt ? new Date(endsAt).getTime() : Number.POSITIVE_INFINITY;
  return Number.isFinite(start) && (!endsAt || Number.isFinite(end)) && start >= 0 && end >= now.getTime();
}

export function matchesDirectoryLocation(itemLocationId: string, selectedLocationId?: string | null): boolean {
  return !selectedLocationId || itemLocationId === selectedLocationId;
}

export function selectRelatedProperties<T>(curated: readonly T[], sameCityApproved: readonly T[], limit = 6): T[] {
  if (!Number.isInteger(limit) || limit < 1) return [];
  return curated.length ? [...curated] : [...sameCityApproved].slice(0, limit);
}

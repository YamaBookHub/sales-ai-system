export function mapCampfireProfileProjectCount(value: string | null) {
  if (!value) return null;
  const number = Number(value.replace(/[^0-9]/g, ''));
  return Number.isFinite(number) ? number : null;
}

export function matchesCampfireProfileProjectRange(
  projectCount: number | null,
  min?: number,
  max?: number
) {
  if (projectCount === null) return false;
  if (typeof min === 'number' && projectCount < min) return false;
  if (typeof max === 'number' && projectCount > max) return false;
  return true;
}

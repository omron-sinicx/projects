// Venue labels come straight from each page's template.yaml, written many ways
// ("CoRL2026", "IROS 2026", "AAMAS22", "RA-L (ICRA2024)"). Normalize to "<name> <yyyy>".

const YEAR = /([A-Za-z)])\s*'?((?:19|20)\d{2}|\d{2})(?=\)|$)/;

export function formatVenue(venue: string | undefined): string | undefined {
  if (!venue) return undefined;
  return venue.trim().replace(YEAR, (_, before: string, y: string) => `${before} ${y.length === 2 ? `20${y}` : y}`);
}

/** Acceptance year, if the venue label carries one. */
export function venueYear(venue: string | undefined): number | undefined {
  const m = venue?.match(/\b((?:19|20)\d{2})\b/);
  return m ? Number(m[1]) : undefined;
}

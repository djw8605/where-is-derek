export interface GeoResult {
  center: [number, number]; // [lng, lat]
  bbox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  featureType: string; // "region" | "place" | "address" | ...
  placeName: string;
}

const CACHE_PREFIX = "wid-geo:v1:";

/**
 * Forward-geocode a free-text location ("South Dakota", "Minneapolis Minnesota")
 * with the Mapbox Geocoding API. Results are cached in localStorage so repeat
 * visits don't re-query.
 */
export async function geocode(query: string, token: string): Promise<GeoResult> {
  const cacheKey = CACHE_PREFIX + query.toLowerCase();
  try {
    const cached = window.localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached) as GeoResult;
  } catch {
    // localStorage unavailable (private mode etc.) — just fetch.
  }

  const url =
    `https://api.mapbox.com/search/geocode/v6/forward` +
    `?q=${encodeURIComponent(query)}&limit=1&access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  const data = await res.json();
  const feature = data.features?.[0];
  if (!feature) throw new Error(`No results for "${query}"`);

  const props = feature.properties ?? {};
  const coords = props.coordinates ?? {};
  const result: GeoResult = {
    center: [
      coords.longitude ?? feature.geometry?.coordinates?.[0],
      coords.latitude ?? feature.geometry?.coordinates?.[1],
    ],
    bbox: props.bbox ?? feature.bbox ?? undefined,
    featureType: props.feature_type ?? "place",
    placeName: props.full_address ?? props.name ?? query,
  };

  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(result));
  } catch {
    // Cache write is best-effort.
  }
  return result;
}

/** Deadpan accuracy disclaimer keyed to how rough the geocode hit is. */
export function precisionNote(featureType: string): string {
  switch (featureType) {
    case "country":
      return "Precision: national. Narrowing it down would be a breach of trust.";
    case "region":
      return "Precision: state-ish. He is in there somewhere. Probably.";
    case "district":
    case "place":
    case "locality":
      return "Precision: city-level, give or take a skyway.";
    default:
      return "Precision: suspiciously exact. We said rough whereabouts.";
  }
}

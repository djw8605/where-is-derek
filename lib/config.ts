// Mapbox public token (pk.*). Supplied via env so the raw token never lives in
// source: NEXT_PUBLIC_MAPBOX_TOKEN in .env.local for local dev, and a build-time
// env var / repo secret for deploys. It IS bundled into the client JS at build
// time — that's expected for a public token. Protect it with a URL restriction
// in your Mapbox account, not by hiding it.
export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export const MAP_STYLE = "mapbox://styles/mapbox/outdoors-v12";

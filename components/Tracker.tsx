"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import { MAPBOX_TOKEN, MAP_STYLE } from "@/lib/config";
import { geocode, precisionNote } from "@/lib/geocode";
import {
  type Schedule,
  type Trip,
  startOfToday,
  findCurrentTrip,
  upcomingTrips,
  completedTrips,
  daysAfieldThisYear,
  daysUntil,
  formatRange,
  formatCoords,
  haversineMiles,
} from "@/lib/schedule";

interface Sighting {
  trip: Trip | null; // null → home
  center: [number, number];
  precision: string;
  distanceFromHome: number;
}

const STAMPS = {
  home: "Specimen at rest",
  work: "Confirmed sighting",
  vacation: "Unconfirmed sighting",
} as const;

const BADGES = {
  home: { className: "home", text: "Home range" },
  work: { className: "work", text: "Work migration" },
  vacation: { className: "vacation", text: "Vacation — do not disturb" },
} as const;

export default function Tracker({ schedule }: { schedule: Schedule }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapFrame = useRef<HTMLElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  const [today, setToday] = useState<Date | null>(null);
  const [sighting, setSighting] = useState<Sighting | null>(null);
  const [geoFailed, setGeoFailed] = useState(false);
  // When set, the map + report card pretend it's this trip's travel dates.
  const [previewTrip, setPreviewTrip] = useState<Trip | null>(null);

  function playTrip(trip: Trip) {
    setPreviewTrip(trip);
    mapFrame.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function returnToLive() {
    setPreviewTrip(null);
  }

  // Date is resolved on the client so a statically-exported page is always
  // current for the viewer, not for whenever the site was last built.
  useEffect(() => {
    setToday(startOfToday());
  }, []);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    if (!MAPBOX_TOKEN) {
      setGeoFailed(true);
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: schedule.home.coordinates,
      zoom: 5.2,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-left");
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [schedule.home.coordinates]);

  useEffect(() => {
    if (!today) return;
    let cancelled = false;
    setGeoFailed(false);

    async function locate() {
      const day = today as Date;
      // A previewed trip wins; otherwise report wherever today lands.
      const trip = previewTrip ?? findCurrentTrip(schedule.trips, day);

      if (!trip) {
        if (!cancelled) {
          setSighting({
            trip: null,
            center: schedule.home.coordinates,
            precision:
              "Precision: high. He is at home in Nebraska, where the horizon is a lifestyle.",
            distanceFromHome: 0,
          });
          placeMarker(schedule.home.coordinates, "home");
          mapRef.current?.flyTo({
            center: schedule.home.coordinates,
            zoom: 6.3,
            duration: 2000,
          });
        }
        return;
      }

      // An explicit coordinate pins exactly there, no geocoding round-trip.
      if (trip.coordinates) {
        if (!cancelled) {
          setSighting({
            trip,
            center: trip.coordinates,
            precision: trip.note ?? precisionNote("place"),
            distanceFromHome: haversineMiles(
              schedule.home.coordinates,
              trip.coordinates,
            ),
          });
          placeMarker(trip.coordinates, trip.type, undefined, trip.icon, trip.zoom);
        }
        return;
      }

      try {
        const geo = await geocode(trip.location, MAPBOX_TOKEN);
        if (cancelled) return;
        setSighting({
          trip,
          center: geo.center,
          precision: trip.note ?? precisionNote(geo.featureType),
          distanceFromHome: haversineMiles(schedule.home.coordinates, geo.center),
        });
        placeMarker(geo.center, trip.type, geo.bbox, trip.icon);
      } catch {
        if (!cancelled) setGeoFailed(true);
      }
    }

    function placeMarker(
      center: [number, number],
      kind: "work" | "vacation" | "home",
      bbox?: [number, number, number, number],
      icon?: string,
      zoom?: number,
    ) {
      const map = mapRef.current;
      if (!map) return;

      markerRef.current?.remove();
      const el = document.createElement("div");
      el.className = `sight-marker ${kind}${icon ? " has-icon" : ""}`;
      el.innerHTML = icon
        ? `<div class="sight-ring"></div><div class="sight-badge"><span>${icon}</span></div>`
        : '<div class="sight-ring"></div><div class="sight-dot"></div>';
      markerRef.current = new mapboxgl.Marker({
        element: el,
        anchor: icon ? "bottom" : "center",
      })
        .setLngLat(center)
        .addTo(map);

      if (bbox) {
        map.fitBounds(bbox, { padding: 70, duration: 2200 });
      } else {
        map.flyTo({ center, zoom: zoom ?? 9.5, duration: 2400 });
      }
    }

    locate();

    return () => {
      cancelled = true;
    };
  }, [today, schedule, previewTrip]);

  const isPreview = previewTrip !== null;
  const kind = sighting ? (sighting.trip?.type ?? "home") : null;
  const upcoming = today ? upcomingTrips(schedule.trips, today) : [];
  const completed = today ? completedTrips(schedule.trips, today).length : 0;
  const afield = today ? daysAfieldThisYear(schedule.trips, today) : 0;
  const nextTrip = upcoming[0] ?? null;
  const nextDeparture = nextTrip && today ? daysUntil(nextTrip.start, today) : null;

  return (
    <main className="wrap">
      <header className="masthead">
        <p className="eyebrow">
          Field tracking station №1 · {schedule.home.location} · Live-ish
        </p>
        <h1>
          Where is Derek<span className="q">?</span>
        </h1>
        <p className="tagline">
          One man. Too many boarding passes. This station reports his rough
          whereabouts so you don&apos;t have to ask.
        </p>
      </header>

      {isPreview && previewTrip && (
        <div className="preview-bar" role="status">
          <span className="pv-label">
            <span className="pv-dot" />
            Simulation — playing {previewTrip.location} as if today were{" "}
            {formatRange(previewTrip.start, previewTrip.end)}
          </span>
          <button type="button" className="pv-return" onClick={returnToLive}>
            Return to live
          </button>
        </div>
      )}

      <section className="map-frame" aria-label="Sighting map" ref={mapFrame}>
        <div ref={mapContainer} className="map" />
        <span className="corner">
          {isPreview
            ? "Signal: simulation"
            : kind
              ? kind === "home"
                ? "Signal: strong"
                : "Signal: roaming"
              : "Acquiring…"}
        </span>

        <div className="report" role="status">
          {!sighting && !geoFailed && (
            <>
              <div className="report-top">
                <span className="stamp">
                  <span className="blip" /> Triangulating…
                </span>
              </div>
              <h2>Locating the specimen</h2>
              <p className="precision">
                Consulting satellites, airline manifests, and one very reliable
                group chat.
              </p>
            </>
          )}

          {geoFailed && (
            <>
              <div className="report-top">
                <span className="stamp">Signal lost</span>
              </div>
              <h2>Derek has evaded the network</h2>
              <p className="precision">
                The map service didn&apos;t answer. He&apos;s still out there.
                Refresh to resume tracking.
              </p>
            </>
          )}

          {sighting && kind && (
            <>
              <div className="report-top">
                <span className="stamp">
                  <span className="blip" /> {STAMPS[kind]}
                </span>
                <span className={`badge ${BADGES[kind].className}`}>
                  {BADGES[kind].text}
                </span>
              </div>
              <h2>
                {sighting.trip?.icon && (
                  <span className="report-icon" aria-hidden="true">
                    {sighting.trip.icon}{" "}
                  </span>
                )}
                {sighting.trip ? sighting.trip.location : schedule.home.location}
              </h2>
              <p className="event">
                {sighting.trip
                  ? sighting.trip.event ?? "Purpose undisclosed"
                  : "Native habitat. Activity levels: normal. No cause for alarm."}
              </p>
              <div className="meta">
                <span>
                  {sighting.trip
                    ? formatRange(sighting.trip.start, sighting.trip.end)
                    : "Until further notice"}
                </span>
                <span>{formatCoords(sighting.center)}</span>
                {sighting.trip && (
                  <span>{sighting.distanceFromHome.toLocaleString()} mi from home</span>
                )}
              </div>
              <p className="precision">{sighting.precision}</p>
            </>
          )}
        </div>
      </section>

      <section className="stats" aria-label="Field statistics">
        <div className="stat">
          <div className="num">{afield}</div>
          <div className="label">Days afield this year</div>
          <div className="sub">His houseplants have opinions.</div>
        </div>
        <div className="stat">
          <div className="num">{completed}</div>
          <div className="label">Migrations logged</div>
          <div className="sub">Round trips, confirmed returns.</div>
        </div>
        <div className="stat">
          <div className="num">
            {nextDeparture === null ? "—" : nextDeparture}
          </div>
          <div className="label">Days until next departure</div>
          <div className="sub">
            {nextTrip
              ? `Destination: ${nextTrip.location}.`
              : "The suitcase rests. For now."}
          </div>
        </div>
      </section>

      <section className="migrations" aria-label="Planned migrations">
        <div className="section-head">
          <h3>Planned migrations</h3>
          <span className="note">Subject to airline whims</span>
        </div>
        <ul className="trip-list">
          {upcoming.length === 0 && (
            <li className="empty-trips">
              No migrations on the books. The specimen is conserving energy and
              possibly mowing the lawn.
            </li>
          )}
          {upcoming.map((trip) => {
            const playing =
              previewTrip?.start === trip.start &&
              previewTrip?.location === trip.location;
            return (
              <li
                className={`trip${playing ? " trip--playing" : ""}`}
                key={`${trip.start}-${trip.location}`}
              >
                <span className="dates">{formatRange(trip.start, trip.end)}</span>
                <span className="where">
                  {trip.icon ? `${trip.icon} ` : ""}
                  {trip.location}
                  {trip.event ? <span className="why"> · {trip.event}</span> : null}
                </span>
                <span className="countdown">
                  {today ? `T−${daysUntil(trip.start, today)} days` : ""}
                </span>
                <button
                  type="button"
                  className={`trip-play${playing ? " playing" : ""}`}
                  onClick={() => (playing ? returnToLive() : playTrip(trip))}
                  aria-label={
                    playing
                      ? `Stop previewing ${trip.location}`
                      : `Preview ${trip.location} as if today`
                  }
                >
                  {playing ? "◼ Playing" : "▶ Play"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <footer className="footer">
        <span>Sightings accurate to within one (1) state.</span>
        <span>Derek is not, legally speaking, tagged.</span>
      </footer>
    </main>
  );
}

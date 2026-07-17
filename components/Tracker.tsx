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
  findTripStartingTomorrow,
  completedTrips,
  daysAfieldThisYear,
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
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  const [today, setToday] = useState<Date | null>(null);
  const [sighting, setSighting] = useState<Sighting | null>(null);
  const [geoFailed, setGeoFailed] = useState(false);

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
      const trip = findCurrentTrip(schedule.trips, day);

      if (!trip) {
        if (!cancelled) {
          setSighting({
            trip: null,
            center: schedule.home.coordinates,
            precision: findTripStartingTomorrow(schedule.trips, day)
              ? "Precision: high. He is at home in Nebraska — but the suitcase has migrated to the front door."
              : "Precision: high. He is at home in Nebraska, where the horizon is a lifestyle.",
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
  }, [today, schedule]);

  const kind = sighting ? (sighting.trip?.type ?? "home") : null;
  const completed = today ? completedTrips(schedule.trips, today).length : 0;
  const afield = today ? daysAfieldThisYear(schedule.trips, today) : 0;

  // Departure eve: a trip begins tomorrow. If today is *also* mid-trip, the
  // specimen is chaining movements without touching the home range.
  const departing = today ? findTripStartingTomorrow(schedule.trips, today) : null;
  const connecting = Boolean(departing && sighting?.trip);

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

      <section className="map-frame" aria-label="Sighting map">
        <div ref={mapContainer} className="map" />
        <span className="corner">
          {kind
            ? departing
              ? "Signal: restless"
              : kind === "home"
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
                  <span className="blip" />{" "}
                  {kind === "home" && departing
                    ? "Pre-migration staging"
                    : STAMPS[kind]}
                </span>
                <span className={`badge ${BADGES[kind].className}`}>
                  {kind === "home" && departing
                    ? "Home range — for now"
                    : BADGES[kind].text}
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

      {departing && (
        <section className="advisory" aria-label="Departure advisory" role="alert">
          <div className="advisory-head">
            <span className="advisory-kicker">
              <span className="blip" /> Zugunruhe advisory
            </span>
            <span className="advisory-count">T−1 day</span>
          </div>
          <h3>
            {connecting
              ? "Connecting migration tomorrow"
              : "Migration departs tomorrow"}
          </h3>
          <p>
            {connecting ? (
              <>
                Back-to-back movements on file: the specimen departs{" "}
                {sighting?.trip?.location} and proceeds directly to{" "}
                <b>{departing.location}</b> without touching the home range.
                Layover: none. Laundry status: unresolved.
              </>
            ) : (
              <>
                The specimen is exhibiting <em>Zugunruhe</em> (n., the
                pre-migratory restlessness of birds). Field notes: circling the
                suitcase, checking the {departing.location} forecast hourly,
                stockpiling snacks. Departure expected at first light.
              </>
            )}
          </p>
          <div className="advisory-meta">
            <span>
              Next range: {departing.icon ? `${departing.icon} ` : ""}
              {departing.location}
            </span>
            <span>{departing.event ?? "Purpose undisclosed"}</span>
            <span>{formatRange(departing.start, departing.end)}</span>
          </div>
        </section>
      )}

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
          <div className="num classified-num">Likely</div>
          <div className="label">More migrations this year?</div>
          <div className="sub">The suitcase has declined to comment.</div>
        </div>
      </section>

      <section className="migrations" aria-label="Future travel notice">
        <div className="section-head">
          <h3>Future movement</h3>
          <span className="note">Need-to-know basis</span>
        </div>
        <div className="classified-card">
          <div className="classified-copy">
            <span className="classified-kicker">
              {departing ? "Travel antenna: vibrating" : "Travel antenna: twitching"}
            </span>
            <p>
              Further roaming appears probable. Dates, destinations, and snack
              strategy remain under wraps until a sighting is in progress.
            </p>
          </div>
          <div className="redacted-file" aria-label="Future itinerary details withheld">
            <span>Next departure</span>
            {departing ? (
              <b className="leak">Tomorrow</b>
            ) : (
              <b aria-hidden="true">████████████</b>
            )}
            <span>Destination</span>
            <b aria-hidden="true">████████████████</b>
            <em>
              {departing
                ? "Filed under: too late to redact"
                : "Filed under: nice try"}
            </em>
          </div>
        </div>
      </section>

      <footer className="footer">
        <span>Sightings accurate to within one (1) state.</span>
        <span>Derek is not, legally speaking, tagged.</span>
      </footer>
    </main>
  );
}

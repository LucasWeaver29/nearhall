"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { HallMenu } from "@/lib/types";
import { NEW_HAVEN_BOUNDS, YALE_CAMPUS } from "@/lib/geo";

type FriendPresence = {
  displayName: string;
  isSelf: boolean;
};

type Props = {
  halls: HallMenu[];
  selectedSlug: string | null;
  userLocation: { lat: number; lng: number } | null;
  routeCoordinates: [number, number][] | null;
  routeSource?: "valhalla" | "straight" | null;
  /** Check-ins keyed by dining-hall slug — used for a subtle map cue. */
  friendsByHall?: Record<string, FriendPresence[]>;
  onSelect: (slug: string) => void;
};

const maxBounds = L.latLngBounds(
  [NEW_HAVEN_BOUNDS.southWest.lat, NEW_HAVEN_BOUNDS.southWest.lng],
  [NEW_HAVEN_BOUNDS.northEast.lat, NEW_HAVEN_BOUNDS.northEast.lng],
);

function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const resize = () => {
      try {
        map.invalidateSize({ animate: false });
      } catch {
        // Map may already be torn down during fast remounts.
      }
    };
    resize();
    const timer = window.setTimeout(resize, 100);
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    window.addEventListener("resize", resize);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      // Allow React Strict Mode / HMR to remount cleanly.
      const el = container as HTMLElement & { _leaflet_id?: number | null };
      el._leaflet_id = undefined;
    };
  }, [map]);
  return null;
}

function FocusSelection({
  halls,
  selectedSlug,
  userLocation,
  routeCoordinates,
}: {
  halls: HallMenu[];
  selectedSlug: string | null;
  userLocation: { lat: number; lng: number } | null;
  routeCoordinates: [number, number][] | null;
}) {
  const map = useMap();
  const selected = halls.find((h) => h.hall.slug === selectedSlug);
  const selectedLat = selected?.hall.latitude;
  const selectedLng = selected?.hall.longitude;
  const userLat = userLocation?.lat;
  const userLng = userLocation?.lng;
  const routeKey = routeCoordinates?.length
    ? `${routeCoordinates.length}:${routeCoordinates[0]?.join(",")}:${routeCoordinates.at(-1)?.join(",")}`
    : "";

  useEffect(() => {
    try {
      if (
        selectedLat != null &&
        selectedLng != null &&
        userLat != null &&
        userLng != null
      ) {
        const points: [number, number][] =
          routeCoordinates && routeCoordinates.length > 1
            ? routeCoordinates
            : [
                [userLat, userLng],
                [selectedLat, selectedLng],
              ];
        map.fitBounds(points, {
          padding: [48, 48],
          maxZoom: 17,
          animate: true,
        });
        return;
      }

      if (selectedLat != null && selectedLng != null) {
        map.setView([selectedLat, selectedLng], 17, { animate: true });
        return;
      }

      const points: [number, number][] = halls.map((h) => [
        h.hall.latitude,
        h.hall.longitude,
      ]);
      if (userLat != null && userLng != null) points.push([userLat, userLng]);
      if (points.length === 0) {
        map.setView([YALE_CAMPUS.center.lat, YALE_CAMPUS.center.lng], 15);
        return;
      }
      if (points.length === 1) {
        map.setView(points[0], 16);
        return;
      }
      map.fitBounds(points, {
        padding: [36, 36],
        maxZoom: 16,
        animate: true,
      });
    } catch {
      // Ignore fit errors during unmount/remount.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit on selection / location / route only
  }, [selectedSlug, selectedLat, selectedLng, userLat, userLng, routeKey, map]);

  return null;
}

function hallIcon(selected: boolean, open: boolean, hasFriends: boolean) {
  const fill = selected ? "#F2B705" : open ? "#0B3A5B" : "#6B7C8A";
  // Inline styles only — Tailwind preflight collapses empty CSS-classed divs
  // (height:0 / border:0), which made every pin disappear.
  const friendRing = hasFriends
    ? `<span style="position:absolute;inset:-6px;border-radius:999px;border:1.5px solid rgba(242,183,5,.55);box-shadow:0 0 0 3px rgba(242,183,5,.12);animation:nearhall-friend-pulse 2.4s ease-out infinite;pointer-events:none"></span><span style="position:absolute;top:-3px;right:-3px;width:7px;height:7px;border-radius:999px;background:#F2B705;border:1px solid #0b1f33;box-shadow:0 0 0 1px rgba(242,183,5,.35);pointer-events:none"></span>`
    : "";
  const size = 16;
  const pad = hasFriends ? 6 : 0;
  const box = size + pad * 2;
  const html = `<div style="position:relative;width:${box}px;height:${box}px;display:flex;align-items:center;justify-content:center"><div style="position:relative;width:${size}px;height:${size}px;border-radius:999px;background:${fill};border:2px solid #F7F3EA;box-shadow:0 1px 4px rgba(11,31,51,.35);box-sizing:border-box;flex:0 0 auto">${friendRing}</div></div>`;
  return L.divIcon({
    className: "nearhall-marker",
    html,
    iconSize: [box, box],
    iconAnchor: [box / 2, box / 2],
  });
}

function friendLabel(people: FriendPresence[]): string {
  if (people.length === 0) return "";
  const names = people
    .slice(0, 3)
    .map((p) => (p.isSelf ? "You" : p.displayName));
  const extra = people.length > 3 ? ` +${people.length - 3}` : "";
  return `Eating here: ${names.join(", ")}${extra}`;
}

export function CampusMap({
  halls,
  selectedSlug,
  userLocation,
  routeCoordinates,
  routeSource = null,
  friendsByHall = {},
  onSelect,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const icons = useMemo(() => {
    return new Map(
      halls.map((row) => [
        row.hall.slug,
        hallIcon(
          row.hall.slug === selectedSlug,
          row.hall.openNow,
          (friendsByHall[row.hall.slug]?.length ?? 0) > 0,
        ),
      ]),
    );
  }, [halls, selectedSlug, friendsByHall]);

  if (!mounted) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#16324a] text-sm text-[#f7f3ea]">
        Loading map…
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <MapContainer
        key="nearhall-campus-map"
        center={[YALE_CAMPUS.center.lat, YALE_CAMPUS.center.lng]}
        zoom={15}
        minZoom={NEW_HAVEN_BOUNDS.minZoom}
        maxBounds={maxBounds}
        maxBoundsViscosity={1}
        className="h-full w-full"
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        attributionControl
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri · Pedestrian routing &copy; Valhalla / OSM"
        />
        <InvalidateOnResize />
        <FocusSelection
          halls={halls}
          selectedSlug={selectedSlug}
          userLocation={userLocation}
          routeCoordinates={routeCoordinates}
        />
        {routeCoordinates && routeCoordinates.length > 1 ? (
          <Polyline
            positions={routeCoordinates}
            pathOptions={{
              color: "#F2B705",
              weight: 4,
              opacity: 0.9,
              lineCap: "round",
              lineJoin: "round",
              dashArray: routeSource === "straight" ? "8 10" : undefined,
            }}
          />
        ) : null}
        {userLocation ? (
          <CircleMarker
            center={[userLocation.lat, userLocation.lng]}
            radius={8}
            pathOptions={{
              color: "#F7F3EA",
              fillColor: "#C45C26",
              fillOpacity: 1,
              weight: 2,
            }}
          >
            <Popup>You are here</Popup>
          </CircleMarker>
        ) : null}
        {halls.map((row) => {
          const people = friendsByHall[row.hall.slug] ?? [];
          const presence = friendLabel(people);
          return (
            <Marker
              key={row.hall.slug}
              position={[row.hall.latitude, row.hall.longitude]}
              icon={icons.get(row.hall.slug)}
              zIndexOffset={people.length > 0 ? 200 : 0}
              eventHandlers={{
                click: () => onSelect(row.hall.slug),
              }}
            >
              <Popup>
                <strong>{row.hall.name}</strong>
                <div>{row.hall.hoursLabel}</div>
                {presence ? (
                  <div style={{ marginTop: 4, color: "#8a6a00" }}>{presence}</div>
                ) : null}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

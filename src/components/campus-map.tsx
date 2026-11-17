"use client";

import { useEffect, useMemo } from "react";
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

type Props = {
  halls: HallMenu[];
  selectedSlug: string | null;
  userLocation: { lat: number; lng: number } | null;
  routeCoordinates: [number, number][] | null;
  routeSource?: "valhalla" | "straight" | null;
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
    const resize = () => map.invalidateSize({ animate: false });
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    window.addEventListener("resize", resize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
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
    // Prefer fitting you + selected hall (and route if present).
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit on selection / location / route only
  }, [selectedSlug, selectedLat, selectedLng, userLat, userLng, routeKey, map]);

  return null;
}

function hallIcon(selected: boolean, open: boolean) {
  const fill = selected ? "#F2B705" : open ? "#0B3A5B" : "#6B7C8A";
  const html = `<div style="width:16px;height:16px;border-radius:999px;background:${fill};border:2px solid #F7F3EA;box-shadow:0 1px 4px rgba(11,31,51,.35)"></div>`;
  return L.divIcon({
    className: "nearhall-marker",
    html,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export function CampusMap({
  halls,
  selectedSlug,
  userLocation,
  routeCoordinates,
  routeSource = null,
  onSelect,
}: Props) {
  const icons = useMemo(() => {
    return new Map(
      halls.map((row) => [
        row.hall.slug,
        hallIcon(row.hall.slug === selectedSlug, row.hall.openNow),
      ]),
    );
  }, [halls, selectedSlug]);

  return (
    <MapContainer
      center={[YALE_CAMPUS.center.lat, YALE_CAMPUS.center.lng]}
      zoom={15}
      minZoom={NEW_HAVEN_BOUNDS.minZoom}
      maxBounds={maxBounds}
      maxBoundsViscosity={1}
      className="h-full w-full"
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
      {halls.map((row) => (
        <Marker
          key={row.hall.slug}
          position={[row.hall.latitude, row.hall.longitude]}
          icon={icons.get(row.hall.slug)}
          eventHandlers={{
            click: () => onSelect(row.hall.slug),
          }}
        >
          <Popup>
            <strong>{row.hall.name}</strong>
            <div>{row.hall.hoursLabel}</div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

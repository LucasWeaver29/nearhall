"use client";

import { useEffect, useMemo } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
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
  onSelect: (slug: string) => void;
};

const maxBounds = L.latLngBounds(
  [NEW_HAVEN_BOUNDS.southWest.lat, NEW_HAVEN_BOUNDS.southWest.lng],
  [NEW_HAVEN_BOUNDS.northEast.lat, NEW_HAVEN_BOUNDS.northEast.lng],
);

function FitBounds({
  halls,
  userLocation,
}: {
  halls: HallMenu[];
  userLocation: { lat: number; lng: number } | null;
}) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = halls.map((h) => [
      h.hall.latitude,
      h.hall.longitude,
    ]);
    if (userLocation) points.push([userLocation.lat, userLocation.lng]);
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
  }, [halls, userLocation, map]);
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

export function CampusMap({ halls, selectedSlug, userLocation, onSelect }: Props) {
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
        attribution="Tiles &copy; Esri"
      />
      <FitBounds halls={halls} userLocation={userLocation} />
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

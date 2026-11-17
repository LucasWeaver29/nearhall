import { NextRequest, NextResponse } from "next/server";
import { haversineMeters } from "@/lib/geo";

type LatLng = { lat: number; lng: number };
type RouteSource = "valhalla" | "straight";

/** Valhalla encodes shapes with polyline precision 6. */
function decodePolyline6(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const factor = 1e6;

  while (index < encoded.length) {
    for (let unit = 0; unit < 2; unit += 1) {
      let shift = 0;
      let result = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (unit === 0) lat += delta;
      else lng += delta;
    }
    coords.push([lat / factor, lng / factor]);
  }
  return coords;
}

function parsePoint(latRaw: string | null, lngRaw: string | null): LatLng | null {
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function straightFallback(from: LatLng, to: LatLng) {
  const meters = haversineMeters(from, to);
  return {
    source: "straight" as const,
    distanceMeters: meters,
    durationSeconds: Math.round(meters / 1.35),
    coordinates: [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ] as [number, number][],
  };
}

function payload(
  source: RouteSource,
  distanceMeters: number,
  durationSeconds: number,
  coordinates: [number, number][],
) {
  return { source, distanceMeters, durationSeconds, coordinates };
}

async function fetchValhallaRoute(from: LatLng, to: LatLng) {
  const res = await fetch("https://valhalla1.openstreetmap.de/route", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      locations: [
        { lat: from.lat, lon: from.lng, type: "break" },
        { lat: to.lat, lon: to.lng, type: "break" },
      ],
      costing: "pedestrian",
      costing_options: {
        pedestrian: {
          walking_speed: 5.1,
          // Prefer footways / shorter campus cuts over long street loops.
          walkway_factor: 0.8,
          alley_factor: 0.9,
          driveway_factor: 0.9,
          step_penalty: 0,
          use_ferry: 0,
        },
      },
      directions_options: { units: "kilometers" },
    }),
    next: { revalidate: 300 },
  });

  if (!res.ok) throw new Error(`Valhalla ${res.status}`);

  const data = (await res.json()) as {
    trip?: {
      summary?: { length?: number; time?: number };
      legs?: Array<{ shape?: string }>;
    };
  };

  const summary = data.trip?.summary;
  const shape = data.trip?.legs?.[0]?.shape;
  if (!summary?.length || !shape) throw new Error("Valhalla empty route");

  const coordinates = decodePolyline6(shape);
  if (coordinates.length < 2) throw new Error("Valhalla bad geometry");

  return {
    distanceMeters: summary.length * 1000,
    durationSeconds: summary.time ?? Math.round((summary.length * 1000) / 1.35),
    coordinates,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const from = parsePoint(searchParams.get("fromLat"), searchParams.get("fromLng"));
  const to = parsePoint(searchParams.get("toLat"), searchParams.get("toLng"));

  if (!from || !to) {
    return NextResponse.json(
      { error: "fromLat, fromLng, toLat, toLng are required" },
      { status: 400 },
    );
  }

  const straight = haversineMeters(from, to);

  // Tiny hops: street routers invent block loops for courtyard-to-courtyard.
  if (straight < 90) {
    return NextResponse.json(straightFallback(from, to));
  }

  try {
    const route = await fetchValhallaRoute(from, to);
    const detourRatio = route.distanceMeters / Math.max(straight, 1);

    // If the walker is sent around whole blocks, prefer a direct campus line.
    if (detourRatio > 2.25 || route.distanceMeters - straight > 450) {
      return NextResponse.json(straightFallback(from, to));
    }

    return NextResponse.json(
      payload(
        "valhalla",
        route.distanceMeters,
        route.durationSeconds,
        route.coordinates,
      ),
    );
  } catch {
    return NextResponse.json(straightFallback(from, to));
  }
}

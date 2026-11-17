import { NextRequest, NextResponse } from "next/server";
import { haversineMeters } from "@/lib/geo";

type LatLng = { lat: number; lng: number };

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
    durationSeconds: Math.round(meters / 1.4), // ~walking pace
    coordinates: [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ] as [number, number][],
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

  const osrmUrl =
    `https://router.project-osrm.org/route/v1/foot/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?overview=full&geometries=geojson`;

  try {
    const res = await fetch(osrmUrl, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return NextResponse.json(straightFallback(from, to));
    }
    const data = (await res.json()) as {
      code?: string;
      routes?: Array<{
        distance: number;
        duration: number;
        geometry?: { coordinates?: [number, number][] };
      }>;
    };
    const route = data.routes?.[0];
    const coords = route?.geometry?.coordinates;
    if (data.code !== "Ok" || !route || !coords?.length) {
      return NextResponse.json(straightFallback(from, to));
    }

    return NextResponse.json({
      source: "osrm" as const,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      // GeoJSON is [lng, lat] — convert to Leaflet [lat, lng]
      coordinates: coords.map(([lng, lat]) => [lat, lng] as [number, number]),
    });
  } catch {
    return NextResponse.json(straightFallback(from, to));
  }
}

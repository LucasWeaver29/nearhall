"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useTransition } from "react";
import { LocateFixed, MapPin, Search, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatDistance,
  isInNewHaven,
  isLikelyOnCampus,
  YALE_CAMPUS,
} from "@/lib/geo";
import { inferMealPeriod } from "@/lib/hours";
import type { HallMenu, MealPeriod, MenusResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

function MapLoading() {
  return (
    <div className="flex h-full items-center justify-center bg-[#16324a] text-[#f7f3ea]">
      Loading campus map...
    </div>
  );
}

const CampusMap = dynamic(
  () => import("@/components/campus-map").then((m) => m.CampusMap),
  { ssr: false, loading: MapLoading },
);

const MEALS: { id: MealPeriod; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
];

export function NearHallApp() {
  const [meal, setMeal] = useState<MealPeriod>(inferMealPeriod());
  const [query, setQuery] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(YALE_CAMPUS.center);
  const [locationMode, setLocationMode] = useState<"gps" | "campus">("campus");
  const [locationNote, setLocationNote] = useState<string | null>(
    "Sorted from central campus — tap Locate me for your GPS.",
  );
  const [locating, setLocating] = useState(false);
  const [data, setData] = useState<MenusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<
    [number, number][] | null
  >(null);
  const [walkSummary, setWalkSummary] = useState<{
    distanceMeters: number;
    durationSeconds: number;
    source: "osrm" | "straight";
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function useCampusFallback(reason: string) {
    setUserLocation(YALE_CAMPUS.center);
    setLocationMode("campus");
    setLocationNote(reason);
    setLocating(false);
  }

  function locate() {
    if (typeof window === "undefined") return;

    if (!window.isSecureContext) {
      useCampusFallback(
        "Location needs HTTPS (or localhost). Using central campus instead.",
      );
      return;
    }

    if (!navigator.geolocation) {
      useCampusFallback(
        "This browser has no geolocation. Using central campus instead.",
      );
      return;
    }

    setLocating(true);
    setLocationNote("Asking for your location…");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserLocation(next);
        setLocationMode("gps");
        setLocating(false);
        if (!isInNewHaven(next)) {
          setLocationNote(
            "GPS found, but you’re outside New Haven — still sorting by distance.",
          );
        } else if (isLikelyOnCampus(next)) {
          setLocationNote("Using your location on / near central campus.");
        } else {
          setLocationNote("Using your GPS location in New Haven.");
        }
      },
      (err) => {
        const denied = err.code === err.PERMISSION_DENIED;
        useCampusFallback(
          denied
            ? "Location permission denied — using central campus. Allow location and tap again."
            : "Couldn’t get GPS — using central campus. Check location settings and tap again.",
        );
      },
      {
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 60_000,
      },
    );
  }

  useEffect(() => {
    // Auto-try GPS once; campus center already seeds distances if it fails.
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      meal,
      q: query,
      open: openOnly ? "1" : "0",
    });
    if (userLocation) {
      params.set("lat", String(userLocation.lat));
      params.set("lng", String(userLocation.lng));
    }

    startTransition(async () => {
      try {
        setError(null);
        const res = await fetch(`/api/menus?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const json = (await res.json()) as MenusResponse;
        setData(json);
        setSelectedSlug((prev) => {
          if (prev && json.halls.some((h) => h.hall.slug === prev)) return prev;
          return json.halls[0]?.hall.slug ?? null;
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError("Could not load menus. Try again in a moment.");
      }
    });

    return () => controller.abort();
  }, [meal, query, openOnly, userLocation]);

  const selected = useMemo(
    () => data?.halls.find((h) => h.hall.slug === selectedSlug) ?? null,
    [data, selectedSlug],
  );

  useEffect(() => {
    if (!selected || !userLocation) {
      setRouteCoordinates(null);
      setWalkSummary(null);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      fromLat: String(userLocation.lat),
      fromLng: String(userLocation.lng),
      toLat: String(selected.hall.latitude),
      toLng: String(selected.hall.longitude),
    });

    fetch(`/api/route?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("route failed");
        return res.json() as Promise<{
          source: "osrm" | "straight";
          distanceMeters: number;
          durationSeconds: number;
          coordinates: [number, number][];
        }>;
      })
      .then((json) => {
        setRouteCoordinates(json.coordinates);
        setWalkSummary({
          distanceMeters: json.distanceMeters,
          durationSeconds: json.durationSeconds,
          source: json.source,
        });
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        setRouteCoordinates([
          [userLocation.lat, userLocation.lng],
          [selected.hall.latitude, selected.hall.longitude],
        ]);
        setWalkSummary(null);
      });

    return () => controller.abort();
  }, [selected, userLocation]);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[#0b1f33] text-[#f7f3ea]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(242,183,5,0.18),transparent_40%),radial-gradient(ellipse_at_bottom_right,rgba(61,125,168,0.25),transparent_45%)]" />

      <header className="relative z-20 mx-auto flex w-full max-w-7xl shrink-0 items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[#f2b705] sm:text-4xl">
            NearHall
          </p>
          <p className="mt-0.5 truncate text-sm text-[#d7e0ea]">
            Closest Yale dining — open now, on the menu.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <button
            type="button"
            disabled={locating}
            onClick={locate}
            className="inline-flex h-9 items-center gap-1.5 bg-[#f7f3ea] px-3 text-sm font-medium text-[#0b1f33] transition hover:bg-white disabled:opacity-60"
          >
            <LocateFixed className={cn("size-4", locating && "animate-pulse")} />
            {locating ? "Locating…" : "Locate me"}
          </button>
          {locationNote ? (
            <p className="hidden max-w-[16rem] text-right text-xs text-[#b8c7d6] sm:block">
              {locationMode === "gps" ? "GPS" : "Campus pin"} · {locationNote}
            </p>
          ) : null}
        </div>
      </header>

      <main className="relative z-10 mx-auto grid min-h-0 w-full max-w-7xl flex-1 gap-3 px-4 pb-3 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-4">
        <section className="relative h-[34vh] min-h-[220px] overflow-hidden border border-[#f7f3ea]/20 lg:h-auto lg:min-h-0">
          <CampusMap
            halls={data?.halls ?? []}
            selectedSlug={selectedSlug}
            userLocation={userLocation}
            routeCoordinates={routeCoordinates}
            onSelect={setSelectedSlug}
          />
          <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-[#0b1f33]/80 px-2 py-1 text-xs text-[#d7e0ea] backdrop-blur">
            {walkSummary
              ? `Walk ~${formatWalkMinutes(walkSummary.durationSeconds)} · ${formatDistance(walkSummary.distanceMeters)}`
              : "New Haven map · sorted by proximity"}
          </div>
        </section>

        <section className="flex min-h-0 flex-col gap-3 overflow-hidden">
          <div className="shrink-0 space-y-3 border border-[#f7f3ea]/15 bg-[#10263d]/80 p-3 backdrop-blur sm:p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8fa3b8]" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search dishes (pizza, tacos, vegan…)"
                className="border-[#f7f3ea]/20 bg-[#0b1f33]/60 pl-9 text-[#f7f3ea] placeholder:text-[#8fa3b8]"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {MEALS.map((item) => (
                <Button
                  key={item.id}
                  size="sm"
                  variant={meal === item.id ? "default" : "outline"}
                  className={cn(
                    meal === item.id
                      ? "bg-[#f2b705] text-[#0b1f33] hover:bg-[#ffc933]"
                      : "border-[#f7f3ea]/25 bg-transparent text-[#f7f3ea] hover:bg-[#f7f3ea]/10",
                  )}
                  onClick={() => setMeal(item.id)}
                >
                  {item.label}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                className={cn(
                  "border-[#f7f3ea]/25 bg-transparent text-[#f7f3ea] hover:bg-[#f7f3ea]/10",
                  openOnly && "bg-[#f7f3ea]/15",
                )}
                onClick={() => setOpenOnly((v) => !v)}
              >
                Open now
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-[#b8c7d6]">
              {data?.source === "sample" ? (
                <Badge variant="secondary" className="bg-[#c45c26] text-white">
                  Sample data
                </Badge>
              ) : null}
              {isPending ? <span>Updating…</span> : null}
              {data ? (
                <span>
                  {data.date} · {data.halls.length} halls
                </span>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="shrink-0 border border-red-300/40 bg-red-950/40 p-3 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
            {(data?.halls ?? []).length === 0 && !isPending ? (
              <EmptyState query={query} />
            ) : null}

            {(data?.halls ?? []).map((row) => (
              <HallRow
                key={row.hall.slug}
                row={row}
                active={row.hall.slug === selectedSlug}
                query={query}
                onSelect={() => setSelectedSlug(row.hall.slug)}
              />
            ))}
          </div>

          {selected ? (
            <div className="max-h-[28vh] shrink-0 overflow-y-auto border border-[#f2b705]/35 bg-[#10263d] p-3 sm:p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-xl text-[#f2b705] sm:text-2xl">
                    {selected.hall.name}
                  </h2>
                  <p className="mt-1 flex items-center gap-1 text-sm text-[#b8c7d6]">
                    <MapPin className="size-3.5" />
                    {selected.hall.address}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <div className={selected.hall.openNow ? "text-[#9ad37f]" : "text-[#f0a39a]"}>
                    {selected.hall.openNow ? "Open" : "Closed"}
                  </div>
                  <div className="text-[#b8c7d6]">{selected.hall.hoursLabel}</div>
                  <div className="text-[#f2b705]">
                    {walkSummary
                      ? `${formatWalkMinutes(walkSummary.durationSeconds)} walk · ${formatDistance(walkSummary.distanceMeters)}`
                      : formatDistance(selected.distanceMeters)}
                  </div>
                </div>
              </div>
              <DishList
                dishes={query ? selected.matchingDishes : selected.dishes}
                query={query}
              />
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function HallRow({
  row,
  active,
  query,
  onSelect,
}: {
  row: HallMenu;
  active: boolean;
  query: string;
  onSelect: () => void;
}) {
  const preview = (query ? row.matchingDishes : row.dishes)
    .slice(0, 3)
    .map((d) => d.name)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full border px-3 py-3 text-left transition duration-200 sm:px-4",
        active
          ? "border-[#f2b705] bg-[#16324a] shadow-[0_0_0_1px_rgba(242,183,5,0.35)]"
          : "border-[#f7f3ea]/12 bg-[#0f2438]/70 hover:border-[#f7f3ea]/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-[#f7f3ea]">{row.hall.name}</div>
          <div className="mt-1 text-xs text-[#9eb0c2]">
            {row.hall.openNow ? "Open" : "Closed"} · {row.hall.hoursLabel}
          </div>
        </div>
        <div className="shrink-0 text-sm text-[#f2b705]">
          {formatDistance(row.distanceMeters)}
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-[#c5d2df]">
        {preview || "No dishes listed for this meal."}
      </p>
    </button>
  );
}

function DishList({
  dishes,
  query,
}: {
  dishes: HallMenu["dishes"];
  query: string;
}) {
  if (dishes.length === 0) {
    return (
      <p className="text-sm text-[#b8c7d6]">
        No matching dishes{query ? ` for “${query}”` : ""} at this hall.
      </p>
    );
  }
  return (
    <ul className="grid max-h-28 gap-1 overflow-y-auto text-sm sm:grid-cols-2">
      {dishes.slice(0, 24).map((dish) => (
        <li key={`${dish.station}-${dish.name}`} className="text-[#e8eef4]">
          <span className="text-[#f2b705]">•</span> {dish.name}
        </li>
      ))}
    </ul>
  );
}

function formatWalkMinutes(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-start gap-2 border border-dashed border-[#f7f3ea]/25 p-4 text-sm text-[#c5d2df]">
      <UtensilsCrossed className="size-5 text-[#f2b705]" />
      <p>
        {query
          ? `Nothing matches “${query}” for this meal. Try another dish or meal period.`
          : "No halls returned. Check back shortly or clear filters."}
      </p>
    </div>
  );
}

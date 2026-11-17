"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useTransition } from "react";
import { LocateFixed, MapPin, Search, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDistance, isLikelyOnCampus } from "@/lib/geo";
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
  } | null>(null);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const [data, setData] = useState<MenusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function locate() {
    if (!navigator.geolocation) {
      setLocationNote("Geolocation is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserLocation(next);
        setLocationNote(
          isLikelyOnCampus(next)
            ? "Using your location on / near central campus."
            : "Location found. Sorting by distance (you may be off central campus).",
        );
      },
      () => {
        setLocationNote(
          "Location blocked — sorting by name. Enable location for nearest halls.",
        );
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  useEffect(() => {
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

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#0b1f33] text-[#f7f3ea]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(242,183,5,0.18),transparent_40%),radial-gradient(ellipse_at_bottom_right,rgba(61,125,168,0.25),transparent_45%)]" />

      <header className="relative z-20 mx-auto flex w-full max-w-7xl items-end justify-between gap-4 px-4 pb-3 pt-5 sm:px-6">
        <div>
          <p className="font-[family-name:var(--font-display)] text-4xl tracking-tight text-[#f2b705] sm:text-5xl">
            NearHall
          </p>
          <p className="mt-1 max-w-xl text-sm text-[#d7e0ea] sm:text-base">
            Find the closest Yale dining hall open now — and what it’s serving.
          </p>
        </div>
        <Button
          variant="secondary"
          className="shrink-0 bg-[#f7f3ea] text-[#0b1f33] hover:bg-white"
          onClick={locate}
        >
          <LocateFixed className="size-4" />
          Locate me
        </Button>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100dvh-7.5rem)] w-full max-w-7xl gap-4 px-4 pb-6 sm:px-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative min-h-[46vh] overflow-hidden rounded-none border border-[#f7f3ea]/20 lg:min-h-0">
          <CampusMap
            halls={data?.halls ?? []}
            selectedSlug={selectedSlug}
            userLocation={userLocation}
            onSelect={setSelectedSlug}
          />
          <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-[#0b1f33]/80 px-2 py-1 text-xs text-[#d7e0ea] backdrop-blur">
            Campus map · sorted by proximity
          </div>
        </section>

        <section className="flex min-h-0 flex-col gap-3">
          <div className="space-y-3 border border-[#f7f3ea]/15 bg-[#10263d]/80 p-3 backdrop-blur sm:p-4">
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
              {locationNote ? <span>{locationNote}</span> : null}
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
            <div className="border border-red-300/40 bg-red-950/40 p-3 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
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
            <div className="border border-[#f2b705]/35 bg-[#10263d] p-3 sm:p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-2xl text-[#f2b705]">
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
                    {formatDistance(selected.distanceMeters)}
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
    <ul className="grid max-h-40 gap-1 overflow-y-auto text-sm sm:grid-cols-2">
      {dishes.slice(0, 24).map((dish) => (
        <li key={`${dish.station}-${dish.name}`} className="text-[#e8eef4]">
          <span className="text-[#f2b705]">•</span> {dish.name}
        </li>
      ))}
    </ul>
  );
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

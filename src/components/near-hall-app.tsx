"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronDown, LocateFixed, MapPin, Search, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SocialPanel,
  type FriendCheckin,
} from "@/components/social-panel";
import {
  formatDistance,
  isInNewHaven,
  isLikelyOnCampus,
  YALE_CAMPUS,
} from "@/lib/geo";
import { menuDayOptions, todayEasternIso } from "@/lib/dates";
import { inferMealPeriod } from "@/lib/hours";
import { formatNutrient, NUTRITION_FACT_ROWS } from "@/lib/nutrition";
import { SOCIAL_ENABLED } from "@/lib/social/config";
import type { HallMenu, MealPeriod, MenuDish, MenusResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const DAY_OPTIONS = menuDayOptions();

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
  const [menuDate, setMenuDate] = useState(todayEasternIso());
  const [query, setQuery] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const isToday = menuDate === todayEasternIso();
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
    source: "valhalla" | "straight";
  } | null>(null);
  const [showNutrition, setShowNutrition] = useState(false);
  const [expandedDishId, setExpandedDishId] = useState<string | null>(null);
  const [friendCheckins, setFriendCheckins] = useState<FriendCheckin[]>([]);
  const [isPending, startTransition] = useTransition();

  const checkinsByHall = useMemo(() => {
    const map = new Map<string, FriendCheckin[]>();
    for (const checkin of friendCheckins) {
      const list = map.get(checkin.hallSlug) ?? [];
      list.push(checkin);
      map.set(checkin.hallSlug, list);
    }
    return map;
  }, [friendCheckins]);

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
    setExpandedDishId(null);
  }, [selectedSlug, menuDate, meal]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      meal,
      date: menuDate,
      q: query,
      open: openOnly && isToday ? "1" : "0",
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
  }, [meal, menuDate, query, openOnly, isToday, userLocation]);

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
          source: "valhalla" | "straight";
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
        <section className="relative h-[34vh] min-h-[220px] overflow-hidden border border-[#f7f3ea]/20 lg:h-full lg:min-h-0">
          <div className="absolute inset-0">
            <CampusMap
              halls={data?.halls ?? []}
              selectedSlug={selectedSlug}
              userLocation={userLocation}
              routeCoordinates={routeCoordinates}
              routeSource={walkSummary?.source ?? null}
              onSelect={setSelectedSlug}
            />
          </div>
          <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-md bg-[#0b1f33]/80 px-2 py-1 text-xs text-[#d7e0ea] backdrop-blur">
            {walkSummary
              ? `${walkSummary.source === "straight" ? "Direct campus" : "Walk"} ~${formatWalkMinutes(walkSummary.durationSeconds)} · ${formatDistance(walkSummary.distanceMeters)}`
              : "New Haven map · sorted by proximity"}
          </div>
        </section>

        <section className="flex min-h-0 flex-col gap-3 overflow-hidden">
          {SOCIAL_ENABLED ? (
            <SocialPanel
              meal={meal}
              menuDate={menuDate}
              selectedHall={
                selected
                  ? { slug: selected.hall.slug, name: selected.hall.name }
                  : null
              }
              onCheckinsChange={setFriendCheckins}
            />
          ) : null}

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
              {DAY_OPTIONS.map((day) => (
                <Button
                  key={day.iso}
                  size="sm"
                  variant={menuDate === day.iso ? "default" : "outline"}
                  title={day.label}
                  className={cn(
                    menuDate === day.iso
                      ? "bg-[#f2b705] text-[#0b1f33] hover:bg-[#ffc933]"
                      : "border-[#f7f3ea]/25 bg-transparent text-[#f7f3ea] hover:bg-[#f7f3ea]/10",
                  )}
                  onClick={() => {
                    setMenuDate(day.iso);
                    if (!day.isToday) setOpenOnly(false);
                  }}
                >
                  {day.shortLabel}
                </Button>
              ))}
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
                  onClick={() => {
                    setMeal(item.id);
                    // Don't carry an Open now filter across meals (lunch after dinner
                    // would hide almost every hall).
                    setOpenOnly(false);
                  }}
                >
                  {item.label}
                </Button>
              ))}
              <button
                type="button"
                disabled={!isToday}
                aria-pressed={openOnly && isToday}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-[min(var(--radius-md),12px)] border px-2.5 text-[0.8rem] font-medium transition",
                  openOnly && isToday
                    ? "border-[#f2b705] bg-[#f2b705] text-[#0b1f33]"
                    : "border-[#f7f3ea]/25 bg-transparent text-[#f7f3ea] hover:bg-[#f7f3ea]/10",
                  !isToday && "cursor-not-allowed opacity-40",
                )}
                onClick={() => {
                  if (!isToday) return;
                  setOpenOnly((v) => !v);
                }}
              >
                {openOnly && isToday ? "Serving now ✓" : "Serving now"}
              </button>
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
              <EmptyState query={query} openOnly={openOnly && isToday} meal={meal} />
            ) : null}

            {(data?.halls ?? []).map((row) => (
              <HallRow
                key={row.hall.slug}
                row={row}
                active={row.hall.slug === selectedSlug}
                query={query}
                distanceMeters={
                  row.hall.slug === selectedSlug && walkSummary
                    ? walkSummary.distanceMeters
                    : row.distanceMeters
                }
                friendCheckins={checkinsByHall.get(row.hall.slug) ?? []}
                onSelect={() => setSelectedSlug(row.hall.slug)}
              />
            ))}
          </div>

          {selected ? (
            <div className="flex max-h-[42vh] shrink-0 flex-col overflow-hidden border border-[#f2b705]/35 bg-[#10263d]">
              <div className="shrink-0 space-y-2 border-b border-[#f7f3ea]/10 p-3 sm:p-4">
                <div className="flex items-start justify-between gap-3">
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
                      {selected.hall.openNow ? "Serving now" : "Not serving now"}
                    </div>
                    <div className="text-[#b8c7d6]">{selected.hall.hoursLabel}</div>
                    <div className="text-[#f2b705]">
                      {walkSummary
                        ? `${formatWalkMinutes(walkSummary.durationSeconds)} walk · ${formatDistance(walkSummary.distanceMeters)}`
                        : formatDistance(selected.distanceMeters)}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    "border-[#f7f3ea]/25 bg-transparent text-[#f7f3ea] hover:bg-[#f7f3ea]/10",
                    showNutrition && "bg-[#f2b705]/20 text-[#f2b705]",
                  )}
                  onClick={() => {
                    setShowNutrition((v) => !v);
                    setExpandedDishId(null);
                  }}
                >
                  {showNutrition ? "Hide nutrition" : "Show nutrition"}
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
                <DishList
                  dishes={query ? selected.matchingDishes : selected.dishes}
                  query={query}
                  showNutrition={showNutrition}
                  expandedDishId={expandedDishId}
                  onToggleDish={(id) =>
                    setExpandedDishId((prev) => (prev === id ? null : id))
                  }
                />
              </div>
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
  distanceMeters,
  friendCheckins,
  onSelect,
}: {
  row: HallMenu;
  active: boolean;
  query: string;
  distanceMeters: number | null;
  friendCheckins: FriendCheckin[];
  onSelect: () => void;
}) {
  const preview = (query ? row.matchingDishes : row.dishes)
    .slice(0, 3)
    .map((d) => d.name)
    .join(" · ");
  const friendLabel = friendCheckins
    .slice(0, 3)
    .map((c) => (c.isSelf ? "You" : c.displayName))
    .join(", ");

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
            {row.hall.openNow ? "Serving now" : "Not serving now"} · {row.hall.hoursLabel}
          </div>
        </div>
        <div className="shrink-0 text-sm text-[#f2b705]">
          {formatDistance(distanceMeters)}
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-[#c5d2df]">
        {preview || "No dishes listed for this meal."}
      </p>
      {friendCheckins.length > 0 ? (
        <p className="mt-1 text-xs text-[#f2b705]">
          Friends here: {friendLabel}
          {friendCheckins.length > 3 ? ` +${friendCheckins.length - 3}` : ""}
        </p>
      ) : null}
    </button>
  );
}

function DishList({
  dishes,
  query,
  showNutrition,
  expandedDishId,
  onToggleDish,
}: {
  dishes: HallMenu["dishes"];
  query: string;
  showNutrition: boolean;
  expandedDishId: string | null;
  onToggleDish: (id: string) => void;
}) {
  if (dishes.length === 0) {
    return (
      <p className="text-sm text-[#b8c7d6]">
        No matching dishes{query ? ` for “${query}”` : ""} at this hall.
      </p>
    );
  }

  if (!showNutrition) {
    return (
      <ul className="grid gap-1 text-sm sm:grid-cols-2">
        {dishes.slice(0, 24).map((dish) => (
          <li key={dish.id} className="text-[#e8eef4]">
            <span className="text-[#f2b705]">•</span> {dish.name}
            {dish.nutrition?.calories != null ? (
              <span className="text-[#9eb0c2]"> · {Math.round(dish.nutrition.calories)} cal</span>
            ) : null}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="space-y-2">
      {dishes.slice(0, 30).map((dish) => (
        <DishNutritionRow
          key={dish.id}
          dish={dish}
          expanded={expandedDishId === dish.id}
          onToggle={() => onToggleDish(dish.id)}
        />
      ))}
    </ul>
  );
}

function DishNutritionRow({
  dish,
  expanded,
  onToggle,
}: {
  dish: MenuDish;
  expanded: boolean;
  onToggle: () => void;
}) {
  const canExpand = Boolean(dish.hasNutrition || dish.ingredients || dish.dietaryTags.length);

  return (
    <li className="border border-[#f7f3ea]/12 bg-[#0b1f33]/50">
      <button
        type="button"
        disabled={!canExpand}
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left disabled:cursor-default"
      >
        <div className="min-w-0">
          <div className="font-medium text-[#f7f3ea]">{dish.name}</div>
          <div className="mt-0.5 text-xs text-[#9eb0c2]">
            {[dish.station, dish.servingSize ? `Serving ${dish.servingSize}` : null]
              .filter(Boolean)
              .join(" · ") || "Menu item"}
            {dish.nutrition?.calories != null
              ? ` · ${Math.round(dish.nutrition.calories)} cal`
              : dish.hasNutrition
                ? ""
                : " · Nutrition unavailable"}
          </div>
          {dish.dietaryTags.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {dish.dietaryTags.slice(0, 6).map((tag) => (
                <span
                  key={tag}
                  className="border border-[#f2b705]/35 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[#f2b705]"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {canExpand ? (
          <ChevronDown
            className={cn(
              "mt-1 size-4 shrink-0 text-[#f2b705] transition",
              expanded && "rotate-180",
            )}
          />
        ) : null}
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-[#f7f3ea]/10 px-3 py-3">
          {dish.nutrition ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#f2b705]">
                Nutrition facts
              </p>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-3">
                {NUTRITION_FACT_ROWS.map((row) => {
                  const value = dish.nutrition?.[row.key];
                  if (value == null) return null;
                  return (
                    <div key={row.key} className="flex justify-between gap-2 border-b border-[#f7f3ea]/8 py-1">
                      <dt className="text-[#b8c7d6]">{row.label}</dt>
                      <dd className="text-[#f7f3ea]">
                        {formatNutrient(value, row.unit, row.digits ?? 0)}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          ) : (
            <p className="text-xs text-[#b8c7d6]">No nutrition panel published for this item.</p>
          )}
          {dish.ingredients ? (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#f2b705]">
                Ingredients
              </p>
              <p className="text-xs leading-relaxed text-[#c5d2df]">{dish.ingredients}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function formatWalkMinutes(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

function EmptyState({
  query,
  openOnly,
  meal,
}: {
  query: string;
  openOnly: boolean;
  meal: MealPeriod;
}) {
  return (
    <div className="flex flex-col items-start gap-2 border border-dashed border-[#f7f3ea]/25 p-4 text-sm text-[#c5d2df]">
      <UtensilsCrossed className="size-5 text-[#f2b705]" />
      <p>
        {query
          ? `Nothing matches “${query}” for this meal. Try another dish or meal period.`
          : openOnly
            ? `No halls are serving ${meal} right now. Turn off “Serving now” to browse the full ${meal} list.`
            : "No halls returned. Check back shortly or clear filters."}
      </p>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SOCIAL_ENABLED } from "@/lib/social/config";
import type { MealPeriod } from "@/lib/types";
import { cn } from "@/lib/utils";

type SocialUser = {
  id: number;
  username: string;
  displayName: string;
  friendCode: string;
};

type Friend = {
  id: number;
  username: string;
  displayName: string;
  friendCode: string;
};

export type FriendCheckin = {
  id: number;
  userId: number;
  displayName: string;
  username: string;
  hallSlug: string;
  hallName: string;
  meal: MealPeriod;
  menuDate: string;
  note: string | null;
  isSelf: boolean;
};

type Props = {
  meal: MealPeriod;
  menuDate: string;
  selectedHall?: { slug: string; name: string } | null;
  onCheckinsChange?: (checkins: FriendCheckin[]) => void;
};

export function SocialPanel({
  meal,
  menuDate,
  selectedHall,
  onCheckinsChange,
}: Props) {
  const [user, setUser] = useState<SocialUser | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [checkins, setCheckins] = useState<FriendCheckin[]>([]);
  const [mode, setMode] = useState<"login" | "register">("register");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [friendCodeInput, setFriendCodeInput] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Collapsed by default so the dining-hall list keeps room for ≥3 options.
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(
      `/api/social/me?meal=${encodeURIComponent(meal)}&date=${encodeURIComponent(menuDate)}`,
    );
    if (!res.ok) return;
    const data = (await res.json()) as {
      user: SocialUser | null;
      friends: Friend[];
      checkins: FriendCheckin[];
    };
    setUser(data.user);
    setFriends(data.friends ?? []);
    setCheckins(data.checkins ?? []);
    onCheckinsChange?.(data.checkins ?? []);
  }, [meal, menuDate, onCheckinsChange]);

  useEffect(() => {
    if (!SOCIAL_ENABLED) return;
    void refresh();
  }, [refresh]);

  if (!SOCIAL_ENABLED) return null;

  async function submitAuth(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(
        mode === "register" ? "/api/social/register" : "/api/social/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, displayName, password }),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Auth failed");
      setPassword("");
      await refresh();
      setMessage(mode === "register" ? "Account created." : "Signed in.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    await fetch("/api/social/logout", { method: "POST" });
    setUser(null);
    setFriends([]);
    setCheckins([]);
    onCheckinsChange?.([]);
    setBusy(false);
  }

  async function addFriend(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/social/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: friendCodeInput }),
      });
      const data = (await res.json()) as { error?: string; friends?: Friend[] };
      if (!res.ok) throw new Error(data.error || "Could not add friend");
      setFriends(data.friends ?? []);
      setFriendCodeInput("");
      setMessage("Friend added.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add friend");
    } finally {
      setBusy(false);
    }
  }

  async function checkIn() {
    if (!selectedHall) {
      setMessage("Select a dining hall first.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/social/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hallSlug: selectedHall.slug,
          hallName: selectedHall.name,
          meal,
          menuDate,
          note,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        checkins?: FriendCheckin[];
      };
      if (!res.ok) throw new Error(data.error || "Could not check in");
      setCheckins(data.checkins ?? []);
      onCheckinsChange?.(data.checkins ?? []);
      setNote("");
      setMessage(`Marked ${selectedHall.name} for ${meal}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not check in");
    } finally {
      setBusy(false);
    }
  }

  const summary = user
    ? `${user.displayName} · ${friends.length} friend${friends.length === 1 ? "" : "s"} · ${checkins.length} eating`
    : "Sign in to mark where you’re eating";

  return (
    <section
      className={cn(
        "shrink-0 border border-[#f7f3ea]/15 bg-[#10263d]/80 backdrop-blur",
        open && "max-h-[min(26vh,13.5rem)] overflow-y-auto overscroll-contain",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left sm:px-4"
      >
        <Users className="size-4 shrink-0 text-[#f2b705]" />
        <h3 className="font-[family-name:var(--font-display)] text-lg text-[#f2b705]">
          Friends
        </h3>
        <span className="rounded border border-[#f2b705]/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[#f2b705]">
          Demo
        </span>
        <span className="ml-auto truncate text-xs text-[#b8c7d6]">{summary}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-[#f2b705] transition",
            open && "rotate-180",
          )}
        />
      </button>

      {!open ? null : !user ? (
        <form onSubmit={submitAuth} className="space-y-2 border-t border-[#f7f3ea]/10 px-3 pb-3 sm:px-4">
          <p className="pt-2 text-xs text-[#b8c7d6]">
            Sign in to add friends and mark where you’re eating.
          </p>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              className={cn(
                "underline-offset-2",
                mode === "register" ? "text-[#f2b705] underline" : "text-[#b8c7d6]",
              )}
              onClick={() => setMode("register")}
            >
              Create account
            </button>
            <button
              type="button"
              className={cn(
                "underline-offset-2",
                mode === "login" ? "text-[#f2b705] underline" : "text-[#b8c7d6]",
              )}
              onClick={() => setMode("login")}
            >
              Sign in
            </button>
          </div>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            className="border-[#f7f3ea]/20 bg-[#0b1f33]/60 text-[#f7f3ea]"
            required
          />
          {mode === "register" ? (
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="display name"
              className="border-[#f7f3ea]/20 bg-[#0b1f33]/60 text-[#f7f3ea]"
            />
          ) : null}
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            className="border-[#f7f3ea]/20 bg-[#0b1f33]/60 text-[#f7f3ea]"
            required
          />
          <button
            type="submit"
            disabled={busy}
            className="h-8 bg-[#f2b705] px-3 text-sm font-medium text-[#0b1f33] disabled:opacity-60"
          >
            {mode === "register" ? "Create account" : "Sign in"}
          </button>
        </form>
      ) : (
        <div className="space-y-3 border-t border-[#f7f3ea]/10 px-3 pb-3 text-sm sm:px-4">
          <div className="flex items-start justify-between gap-2 pt-2">
            <div>
              <p className="text-[#f7f3ea]">{user.displayName}</p>
              <p className="text-xs text-[#9eb0c2]">@{user.username}</p>
              <p className="mt-1 text-xs text-[#f2b705]">
                Your code: <span className="font-mono">{user.friendCode}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="text-xs text-[#b8c7d6] underline-offset-2 hover:underline"
            >
              Sign out
            </button>
          </div>

          <form onSubmit={addFriend} className="flex gap-2">
            <Input
              value={friendCodeInput}
              onChange={(e) => setFriendCodeInput(e.target.value)}
              placeholder="Friend code (YALE-…)"
              className="border-[#f7f3ea]/20 bg-[#0b1f33]/60 text-[#f7f3ea]"
            />
            <button
              type="submit"
              disabled={busy}
              className="shrink-0 border border-[#f7f3ea]/25 px-2 text-xs text-[#f7f3ea] hover:bg-[#f7f3ea]/10"
            >
              Add
            </button>
          </form>

          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-[#9eb0c2]">
              Friends ({friends.length})
            </p>
            {friends.length === 0 ? (
              <p className="text-xs text-[#b8c7d6]">
                Add a teammate’s code so they appear in your meal feed.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-1">
                {friends.map((friend) => (
                  <li
                    key={friend.id}
                    className="border border-[#f7f3ea]/15 px-2 py-0.5 text-xs text-[#d7e0ea]"
                  >
                    {friend.displayName}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2 border-t border-[#f7f3ea]/10 pt-3">
            <p className="text-xs text-[#b8c7d6]">
              Selected:{" "}
              <span className="text-[#f7f3ea]">
                {selectedHall?.name ?? "pick a hall in the list"}
              </span>
            </p>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note (table by the window…)"
              className="border-[#f7f3ea]/20 bg-[#0b1f33]/60 text-[#f7f3ea]"
            />
            <button
              type="button"
              disabled={busy || !selectedHall}
              onClick={() => void checkIn()}
              className="h-8 bg-[#f2b705] px-3 text-sm font-medium text-[#0b1f33] disabled:opacity-60"
            >
              I’m eating here · {meal}
            </button>
          </div>

          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-[#9eb0c2]">
              Friends eating · {meal}
            </p>
            {checkins.length === 0 ? (
              <p className="text-xs text-[#b8c7d6]">No check-ins yet for this meal.</p>
            ) : (
              <ul className="space-y-1">
                {checkins.map((c) => (
                  <li key={c.id} className="text-xs text-[#d7e0ea]">
                    <span className="text-[#f2b705]">
                      {c.isSelf ? "You" : c.displayName}
                    </span>{" "}
                    → {c.hallName}
                    {c.note ? ` · “${c.note}”` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {open && message ? (
        <p className="px-3 pb-3 text-xs text-[#f2b705] sm:px-4">{message}</p>
      ) : null}
    </section>
  );
}

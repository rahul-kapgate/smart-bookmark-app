"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import type { RealtimeChannel } from "@supabase/supabase-js";

type Bookmark = {
  id: string;
  user_id: string;
  title: string;
  url: string;
  created_at: string;
};

function normalizeUrl(raw: string) {
  const v = raw.trim();
  if (!v) return "";
  if (!/^https?:\/\//i.test(v)) return `https://${v}`;
  return v;
}

function getHostname(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export default function Bookmarks({ userId }: { userId: string }) {
  // Create Supabase client once for this component
  const supabase = useMemo(() => createClient(), []);

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  const [items, setItems] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  /**
   * Fetch bookmarks (RLS ensures we only see our own rows).
   */
  const fetchBookmarks = useCallback(async () => {
    const { data, error } = await supabase
      .from("bookmarks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage({ type: "err", text: error.message });
      return;
    }
    setItems((data ?? []) as Bookmark[]);
  }, [supabase]);

  // Realtime subscription to sync changes from other tabs/devices.
  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    const setupRealtime = async () => {
      // 1) Ensure we have a fresh session token
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      // 2) IMPORTANT: set realtime auth before joining (RLS depends on this)
      if (accessToken) {
        supabase.realtime.setAuth(accessToken);
      }

      // 3) Create channel (use a unique name)
      channel = supabase
        .channel(`bookmarks:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "bookmarks",
            filter: `user_id=eq.${userId}`,
          },
          async () => {
            // Sync changes from OTHER tabs/devices
            await fetchBookmarks();
          },
        )
        .subscribe((status) => {
          console.log("[Realtime] status:", status);
        });
    };

    setupRealtime();

    // 4) Keep realtime auth in sync with token refresh / sign-in
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.access_token) {
          supabase.realtime.setAuth(session.access_token);
        }
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, userId, fetchBookmarks]);

  useEffect(() => {
    const onFocus = () => fetchBookmarks();
    window.addEventListener("visibilitychange", () => {
      if (!document.hidden) onFocus();
    });
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchBookmarks]);

  /**
   * Initial load + realtime subscription.
   * Realtime is mainly to sync changes from OTHER tabs/devices.
   */
  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      await fetchBookmarks();
      if (mounted) setLoading(false);
    })();

    // Listen only to changes for the current user
    const channel = supabase
      .channel("bookmarks-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookmarks",
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          // For cross-tab sync: refetch when something changes
          await fetchBookmarks();
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, fetchBookmarks]);

  /**
   * Auto-hide small toast messages
   */
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 2500);
    return () => clearTimeout(t);
  }, [message]);

  /**
   * ADD BOOKMARK
   * IMPORTANT: Update UI immediately in current tab (do not wait for realtime).
   * We request the inserted row back using .select().single()
   */
  const addBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const t = title.trim();
    const u = normalizeUrl(url);

    if (!t) return setMessage({ type: "err", text: "Please enter a title." });
    if (!u) return setMessage({ type: "err", text: "Please enter a URL." });

    try {
      new URL(u);
    } catch {
      return setMessage({ type: "err", text: "Please enter a valid URL." });
    }

    setSubmitting(true);

    const { data, error } = await supabase
      .from("bookmarks")
      .insert({ user_id: userId, title: t, url: u })
      // return the inserted row so we can update UI instantly
      .select("*")
      .single();

    setSubmitting(false);

    if (error) {
      setMessage({ type: "err", text: error.message });
      return;
    }

    // ✅ Update current tab immediately (no reload needed)
    if (data) {
      setItems((prev) => [data as Bookmark, ...prev]);
    } else {
      // fallback (rare) - refetch
      await fetchBookmarks();
    }

    setTitle("");
    setUrl("");
    setMessage({ type: "ok", text: "Bookmark added!" });
  };

  /**
   * DELETE BOOKMARK
   * IMPORTANT: Remove from UI immediately after successful delete.
   */
  const deleteBookmark = async (id: string) => {
    setMessage(null);
    setDeletingId(id);

    const { error } = await supabase.from("bookmarks").delete().eq("id", id);

    setDeletingId(null);

    if (error) {
      setMessage({ type: "err", text: error.message });
      return;
    }

    // ✅ Update current tab immediately (no reload needed)
    setItems((prev) => prev.filter((b) => b.id !== id));
    setMessage({ type: "ok", text: "Deleted." });
  };

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-indigo-50 via-white to-sky-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-linear-to-br from-indigo-600 to-sky-500 text-white shadow-sm">
              ★
            </div>
            <div>
              <p className="text-sm font-semibold leading-4">
                Smart Bookmark App
              </p>
              <p className="text-xs text-slate-500">Private • Realtime </p>
            </div>
          </div>

          <button
            onClick={logout}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {message && (
          <div
            className={[
              "mb-4 rounded-xl border px-4 py-3 text-sm shadow-sm",
              message.type === "ok"
                ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                : "border-rose-200 bg-rose-50 text-rose-800",
            ].join(" ")}
          >
            {message.text}
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-lg font-semibold">Add a bookmark</h1>
          <p className="mt-1 text-sm text-slate-500">
            Add in one tab → it appears in other tabs instantly.
          </p>

          <form onSubmit={addBookmark} className="mt-4 grid gap-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-slate-600">
                  Title
                </label>
                <input
                  className="h-11 rounded-xl border border-slate-200 px-3 outline-none ring-indigo-200 focus:ring-4"
                  placeholder="e.g. Supabase Docs"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-slate-600">
                  URL
                </label>
                <input
                  className="h-11 rounded-xl border border-slate-200 px-3 outline-none ring-indigo-200 focus:ring-4"
                  placeholder="supabase.com/docs"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
            </div>

            <button
              disabled={submitting}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
            >
              {submitting ? "Adding..." : "Add Bookmark"}
            </button>
          </form>
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-base font-semibold">Your bookmarks</h2>
            <p className="text-sm text-slate-500">{items.length} total</p>
          </div>

          {loading ? (
            <div className="grid gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 rounded-2xl border border-slate-200 bg-white shadow-sm"
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <p className="text-base font-semibold">No bookmarks yet</p>
              <p className="mt-1 text-sm text-slate-500">
                Add your first bookmark above.
              </p>
            </div>
          ) : (
            <ul className="grid gap-3">
              {items.map((b) => {
                const host = getHostname(b.url);
                const favicon = host
                  ? `https://www.google.com/s2/favicons?domain=${host}&sz=64`
                  : null;

                return (
                  <li
                    key={b.id}
                    className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                          {favicon ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={favicon} alt="" className="h-6 w-6" />
                          ) : (
                            <span className="text-sm font-semibold text-slate-600">
                              🔗
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {b.title}
                        </p>
                        <a
                          href={b.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block break-all text-sm text-indigo-600 underline-offset-2 hover:underline"
                        >
                          {b.url}
                        </a>

                        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5">
                            {host || "link"}
                          </span>
                          <span>•</span>
                          <span>{new Date(b.created_at).toLocaleString()}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => deleteBookmark(b.id)}
                        disabled={deletingId === b.id}
                        className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                      >
                        {deletingId === b.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <footer className="mt-10 text-center text-xs text-slate-500">
          Next.js + Supabase Realtime • Privacy via RLS
        </footer>
      </main>
    </div>
  );
}

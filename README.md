# Smart Bookmark App

A simple bookmark manager built with **Next.js (App Router)** + **Supabase (Auth, Database, Realtime)** + **Tailwind CSS**.

## Features

- ✅ Sign in with **Google OAuth only** (no email/password)
- ✅ Add bookmarks (Title + URL)
- ✅ Bookmarks are **private per user** (Row Level Security)
- ✅ **Realtime updates** across tabs (add/delete in one tab appears in the other)
- ✅ Delete your own bookmarks
- ✅ Deployable to Vercel

---

## Tech Stack

- Next.js (App Router)
- Supabase (Auth + Postgres + Realtime)
- Tailwind CSS
- TypeScript

---

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

## Problems I ran into & how I solved them
1) Google OAuth redirect going to wrong URL (or localhost)

- Problem: After signing in with Google, redirect sometimes went to localhost or unexpected URL.
- ✅ Solution: Added the exact callback URL(s) to Supabase Redirect URLs and made sure redirectTo matches exactly (e.g. ${window.location.origin}/auth/callback). Supabase only redirects to allow-listed URLs.

2) Next.js App Router cookies TypeScript error in auth callback

- Problem: In the /auth/callback route handler, using cookies().get() / cookies().set() caused TypeScript errors and session cookies weren’t persisted reliably.
- ✅Solution: Used request.cookies.getAll() and response.cookies.set(...) (request/response cookie adapter) with createServerClient() so cookies are written correctly in Route Handlers.

3) Realtime “two tab” sync inconsistent (one direction works, other doesn’t)

- Problem: With two tabs open, changes sometimes updated only one tab. One tab was not receiving realtime events reliably (especially with RLS).

- ✅ Solution: Updated the current tab UI immediately after insert/delete (so no hard reload needed).
   Ensured Realtime is enabled for the table, and refreshed the list on realtime events for cross-tab sync.
   When needed, set realtime auth token before subscribing and keep it updated on auth state changes (to avoid stale websocket auth).

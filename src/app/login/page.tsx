"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

/**
 * Small Google logo SVG for the button.
 * (Avoids extra icon libraries.)
 */
function GoogleIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.668 32.657 29.303 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.301 4 24 4 12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.654 16.108 19.002 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.301 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.199 0 9.86-1.991 13.409-5.229l-6.191-5.238C29.205 35.091 26.715 36 24 36c-5.281 0-9.632-3.324-11.273-7.946l-6.522 5.025C9.49 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.786 2.212-2.301 4.086-4.285 5.294l.003-.002 6.191 5.238C36.78 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Google OAuth sign-in (Supabase)
   * redirectTo must match what you added in Supabase Auth settings:
   *   http://localhost:3000/auth/callback
   *   https://your-vercel-url.vercel.app/auth/callback
   */
  const signInWithGoogle = async () => {
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    // If Supabase returns an error (rare), show it.
    // Otherwise, browser will redirect to Google automatically.
    if (error) {
      setLoading(false);
      setError(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-indigo-50 via-white to-sky-50 text-slate-900">
      {/* Soft background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-sky-200/40 blur-3xl" />
      </div>

      <div className="relative grid min-h-screen place-items-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-linear-to-br from-indigo-600 to-sky-500 text-white shadow-sm">
              ★
            </div>
            <div>
              <h1 className="text-xl font-semibold">Smart Bookmark App</h1>
              <p className="text-sm text-slate-600">
                Private bookmarks with realtime sync
              </p>
            </div>
          </div>

          {/* Info */}
          <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
            Sign in with Google to create, view, and manage your bookmarks.
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          )}

          {/* Button */}
          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="mt-5 inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            aria-busy={loading}
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Redirecting...
              </>
            ) : (
              <>
                <GoogleIcon />
                Continue with Google
              </>
            )}
          </button>

          {/* Footer */}
          <p className="mt-4 text-center text-xs text-slate-500">
            By continuing, you’ll authenticate via Google OAuth.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Login page skeleton.
 *
 * Agent: build the login UI here as a "use client" component with:
 *
 *   LAYOUT (split-screen):
 *     LEFT SIDE (dark background, ~60% width):
 *     - App brand name and logo
 *     - Tagline / description of the MES app
 *     - 2-3 feature highlights with icons
 *
 *     RIGHT SIDE (white card, ~40% width):
 *     - "Welcome back" heading
 *     - SSO button (see below)
 *     - Separator ("or")
 *     - Quick Login panel: clickable user cards from users.ts
 *     - Username + password form
 *
 *   SSO BUTTON:
 *     import { isSSOEnabled, getLoginURL } from "@/lib/sso";
 *     - Only render if isSSOEnabled() returns true
 *     - onClick: window.location.href = getLoginURL()
 *
 *   LOCAL LOGIN:
 *     POST /api/auth/login with { username, password }
 *     On success: redirect to "/"
 *     On failure: toast.error()
 *
 *   QUICK LOGIN CARDS:
 *     POST /api/auth/login with the card user's credentials
 *     Each card: avatar/initials, displayName, role badge
 *
 *   COOKIE FORMAT: { userId, role, displayName, username }
 */

export default function LoginPage() {
  return (
    <div className="flex h-screen items-center justify-center bg-white">
      <div className="w-full max-w-sm space-y-6 px-6">
        <div>
          <h1 className="text-lg font-semibold">Sign in</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Select a user or enter credentials to continue.
          </p>
        </div>
        {/* Agent: build the login UI here */}
      </div>
    </div>
  );
}

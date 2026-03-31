/**
 * Login page skeleton.
 *
 * Agent: build the login UI here. Include:
 *   - Username + password form
 *   - Quick Login panel with clickable user cards (for fast demo switching)
 *   - On success: set cookie "mes-session" as JSON { userId, role }, then redirect to "/"
 *   - On failure: show error message
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
        {/* Agent: add login form and quick-login cards here */}
      </div>
    </div>
  );
}

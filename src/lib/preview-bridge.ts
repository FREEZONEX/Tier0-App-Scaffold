export const PREVIEW_ERROR_TYPE = 'tier0.preview.error';
export const PREVIEW_READY_TYPE = 'tier0.preview.ready';

export type PreviewErrorKind = 'auth' | 'app' | 'network' | 'role';

/**
 * Message prefix of the 403 thrown by `requireAuth(...roles)` when the current
 * user holds none of the required roles. Server-function errors cross to the
 * browser as a plain `Error(message)` (TanStack Start serializes only the
 * message), so the route error boundary recognizes role failures by it.
 */
export const ROLE_REQUIRED_MESSAGE_PREFIX = 'Requires role:';

/**
 * True when a route failure comes from the preview role (no role selected, or
 * the selected roles lack access), not from the App code: a 403 surfaced by
 * `requestJson`, or a `requireAuth` role failure from a server function. The
 * Builder routes these to the preview role troubleshooting instead of asking
 * the agent to rewrite the page.
 */
export function isPreviewRoleError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { status, message } = error as { status?: unknown; message?: unknown };
  if (status === 403) return true;
  return typeof message === 'string' && message.includes(ROLE_REQUIRED_MESSAGE_PREFIX);
}

let previewReadySent = false;

function getPreviewParentTargetOrigin(): string {
  const ancestorOrigins = window.location.ancestorOrigins;
  if (ancestorOrigins?.length) {
    return ancestorOrigins[0];
  }

  try {
    if (document.referrer) {
      const referrerOrigin = new URL(document.referrer).origin;
      if (referrerOrigin !== window.location.origin) {
        return referrerOrigin;
      }
    }
  } catch {
    // Fall back to "*" for non-sensitive preview status messages.
  }

  return '*';
}

export function sendPreviewError(error: string, kind: PreviewErrorKind): void {
  if (window.parent === window) return;
  const targetOrigin = getPreviewParentTargetOrigin();
  window.parent.postMessage({ type: PREVIEW_ERROR_TYPE, error, kind }, targetOrigin);
}

export function sendPreviewReady(): void {
  if (previewReadySent) return;
  if (window.parent === window) return;
  previewReadySent = true;
  const targetOrigin = getPreviewParentTargetOrigin();
  window.parent.postMessage({ type: PREVIEW_READY_TYPE }, targetOrigin);
}

export const PREVIEW_ERROR_TYPE = 'tier0.preview.error';
export const PREVIEW_READY_TYPE = 'tier0.preview.ready';

export type PreviewErrorKind = 'auth' | 'app' | 'network';

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

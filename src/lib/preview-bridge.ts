export const PREVIEW_ERROR_TYPE = 'tier0.preview.error';
export const PREVIEW_READY_TYPE = 'tier0.preview.ready';

export type PreviewErrorKind = 'auth' | 'app' | 'network';

let previewReadySent = false;

export function sendPreviewError(error: string, kind: PreviewErrorKind): void {
  if (window.parent === window) return;
  const targetOrigin = document.referrer ? new URL(document.referrer).origin : '*';
  window.parent.postMessage({ type: PREVIEW_ERROR_TYPE, error, kind }, targetOrigin);
}

export function sendPreviewReady(): void {
  if (previewReadySent) return;
  if (window.parent === window) return;
  previewReadySent = true;
  const targetOrigin = document.referrer ? new URL(document.referrer).origin : '*';
  window.parent.postMessage({ type: PREVIEW_READY_TYPE }, targetOrigin);
}

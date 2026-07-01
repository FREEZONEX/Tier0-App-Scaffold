export const PREVIEW_ERROR_TYPE = 'tier0.preview.error';

export function sendPreviewError(error: string): void {
  if (window.parent === window) return;
  const targetOrigin = document.referrer ? new URL(document.referrer).origin : '*';
  window.parent.postMessage({ type: PREVIEW_ERROR_TYPE, error }, targetOrigin);
}

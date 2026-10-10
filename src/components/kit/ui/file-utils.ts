/** File helpers for ImageUpload / AttachmentUpload / previews. */
import type { FileValue } from "@/lib/component-kit/types";

export type { FileValue };

export const IMAGE_ACCEPT = ".png,.jpg,.jpeg,.gif,.webp,.bmp";

export function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileExtension(name: string): string {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index + 1).toLowerCase() : "";
}

export function isImageFile(file: Pick<FileValue, "name" | "type" | "url">): boolean {
  if (file.type?.startsWith("image/")) return true;
  if (file.url?.startsWith("data:image/")) return true;
  return ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(fileExtension(file.name));
}

export function isPdfFile(file: Pick<FileValue, "name" | "type" | "url">): boolean {
  return (
    file.type === "application/pdf" ||
    file.url?.startsWith("data:application/pdf") === true ||
    fileExtension(file.name) === "pdf"
  );
}

/** Same semantics as the input `accept` attribute. */
export function matchesAccept(file: File, accept?: string): boolean {
  if (!accept?.trim()) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept.split(",").some((raw) => {
    const token = raw.trim().toLowerCase();
    if (!token) return false;
    if (token.startsWith(".")) return name.endsWith(token);
    if (token.endsWith("/*")) return type.startsWith(token.slice(0, -1));
    return type === token;
  });
}

export function createFileUid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `file-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

export async function fileToValue(file: File): Promise<FileValue> {
  return {
    uid: createFileUid(),
    name: file.name,
    url: await readFileAsDataUrl(file),
    size: file.size,
    type: file.type || undefined,
  };
}

/** data: URL → Blob (null for other URLs). */
export function dataUrlToBlob(url: string): Blob | null {
  const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(url);
  if (!match) return null;
  const mime = match[1] || "application/octet-stream";
  const payload = match[3];
  if (match[2]) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(payload)], { type: mime });
}

/** Browser-openable URL for a file value; revoke with `release()` when done. */
export function objectUrlFor(file: FileValue): { url: string; release: () => void } {
  const blob = file.url.startsWith("data:") ? dataUrlToBlob(file.url) : null;
  if (!blob) return { url: file.url, release: () => undefined };
  const url = URL.createObjectURL(blob);
  return { url, release: () => URL.revokeObjectURL(url) };
}

export function downloadFileValue(file: FileValue) {
  const { url, release } = objectUrlFor(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name || "download";
  link.rel = "noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(release, 1000);
}

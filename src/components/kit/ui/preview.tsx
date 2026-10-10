"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, RotateCw, X, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadFileValue, objectUrlFor, type FileValue } from "@/components/kit/ui/file-utils";

function useLightboxLifecycle(open: boolean, onKey: (event: KeyboardEvent) => void) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      onKey(event);
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open, onKey]);
}

const TOOL_BUTTON =
  "inline-flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-40";

export interface ImagePreviewProps {
  images: FileValue[];
  /** Index of the image shown; null = closed. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
}

/** ImagePreview — full-screen image viewer with prev / next, zoom, rotate and download. */
export function ImagePreview({ images, index, onIndexChange }: ImagePreviewProps) {
  const open = index !== null && images.length > 0;
  const safeIndex = open ? Math.min(Math.max(index ?? 0, 0), images.length - 1) : 0;
  const image = open ? images[safeIndex] : null;
  const [transform, setTransform] = useState({ key: "", scale: 1, rotate: 0 });
  const imageKey = image ? `${image.uid}-${safeIndex}` : "";
  const scale = transform.key === imageKey ? transform.scale : 1;
  const rotate = transform.key === imageKey ? transform.rotate : 0;

  const handleKey = useMemo(
    () => (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onIndexChange(null);
      } else if (event.key === "ArrowLeft" && safeIndex > 0) {
        onIndexChange(safeIndex - 1);
      } else if (event.key === "ArrowRight" && safeIndex < images.length - 1) {
        onIndexChange(safeIndex + 1);
      }
    },
    [onIndexChange, safeIndex, images.length],
  );
  useLightboxLifecycle(open, handleKey);

  if (!open || !image || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      className="fixed inset-0 z-[1100] flex animate-tier0-fade flex-col bg-black/80"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onIndexChange(null);
      }}
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 text-white">
        <div className="min-w-0 truncate text-sm">
          {image.name}
          {images.length > 1 ? (
            <span className="ml-3 tabular-nums text-white/70">
              {safeIndex + 1} / {images.length}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label="缩小"
            title="缩小"
            className={TOOL_BUTTON}
            onClick={() => setTransform({ key: imageKey, scale: Math.max(0.25, scale - 0.25), rotate })}
          >
            <ZoomOut className="size-4" />
          </button>
          <button
            type="button"
            aria-label="放大"
            title="放大"
            className={TOOL_BUTTON}
            onClick={() => setTransform({ key: imageKey, scale: Math.min(4, scale + 0.25), rotate })}
          >
            <ZoomIn className="size-4" />
          </button>
          <button
            type="button"
            aria-label="旋转"
            title="旋转"
            className={TOOL_BUTTON}
            onClick={() => setTransform({ key: imageKey, scale, rotate: (rotate + 90) % 360 })}
          >
            <RotateCw className="size-4" />
          </button>
          <button
            type="button"
            aria-label="下载"
            title="下载"
            className={TOOL_BUTTON}
            onClick={() => downloadFileValue(image)}
          >
            <Download className="size-4" />
          </button>
          <button type="button" aria-label="关闭" title="关闭" className={TOOL_BUTTON} onClick={() => onIndexChange(null)}>
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-14 pb-10"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onIndexChange(null);
        }}
      >
        <img
          key={imageKey}
          src={image.url}
          alt={image.name}
          className="max-h-full max-w-full animate-tier0-pop select-none object-contain shadow-2xl transition-transform duration-200"
          style={{ transform: `scale(${scale}) rotate(${rotate}deg)` }}
          draggable={false}
        />
        {images.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="上一张"
              disabled={safeIndex === 0}
              className={cn(TOOL_BUTTON, "absolute left-3 top-1/2 size-10 -translate-y-1/2")}
              onClick={() => onIndexChange(safeIndex - 1)}
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="下一张"
              disabled={safeIndex === images.length - 1}
              className={cn(TOOL_BUTTON, "absolute right-3 top-1/2 size-10 -translate-y-1/2")}
              onClick={() => onIndexChange(safeIndex + 1)}
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export interface FilePreviewProps {
  /** File to show (PDF or any browser-viewable type); null = closed. */
  file: FileValue | null;
  onClose: () => void;
}

/** FilePreview — full-screen document viewer (PDF) with download. */
export function FilePreview({ file, onClose }: FilePreviewProps) {
  const open = file !== null;
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    const { url, release } = objectUrlFor(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setObjectUrl(url);
    return () => {
      release();
      setObjectUrl(null);
    };
  }, [file]);

  const handleKey = useMemo(
    () => (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    },
    [onClose],
  );
  useLightboxLifecycle(open, handleKey);

  if (!file || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="文件预览"
      className="fixed inset-0 z-[1100] flex animate-tier0-fade flex-col bg-black/80"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 text-white">
        <div className="min-w-0 truncate text-sm">{file.name}</div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" aria-label="下载" title="下载" className={TOOL_BUTTON} onClick={() => downloadFileValue(file)}>
            <Download className="size-4" />
          </button>
          <button type="button" aria-label="关闭" title="关闭" className={TOOL_BUTTON} onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 px-4 pb-4">
        {objectUrl ? (
          <iframe title={file.name} src={objectUrl} className="size-full rounded-lg border-0 bg-white" />
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

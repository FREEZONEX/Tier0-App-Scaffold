"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { Download, Eye, FileText, ImageIcon, Paperclip, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  IMAGE_ACCEPT,
  downloadFileValue,
  fileToValue,
  formatFileSize,
  isImageFile,
  isPdfFile,
  matchesAccept,
  type FileValue,
} from "@/components/kit/ui/file-utils";
import { FilePreview, ImagePreview } from "@/components/kit/ui/preview";

function reportError(message: string, onError?: (message: string) => void) {
  if (onError) onError(message);
  else toast.error(message);
}

async function acceptFiles({
  picked,
  existingCount,
  maxCount,
  maxSizeMb,
  accept,
  kindLabel,
  onError,
}: {
  picked: File[];
  existingCount: number;
  maxCount: number;
  maxSizeMb: number;
  accept?: string;
  kindLabel: string;
  onError?: (message: string) => void;
}): Promise<FileValue[]> {
  const room = Math.max(0, maxCount - existingCount);
  if (picked.length > room) {
    reportError(`最多上传 ${maxCount} 个${kindLabel}，已忽略超出的 ${picked.length - room} 个`, onError);
  }
  const accepted: File[] = [];
  for (const file of picked.slice(0, room)) {
    if (!matchesAccept(file, accept)) {
      reportError(`「${file.name}」格式不支持，请上传 ${accept?.replaceAll(",", " / ")} 文件`, onError);
      continue;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      reportError(`「${file.name}」超过 ${maxSizeMb}MB，请压缩后再上传`, onError);
      continue;
    }
    accepted.push(file);
  }
  try {
    return await Promise.all(accepted.map(fileToValue));
  } catch {
    reportError(`${kindLabel}读取失败，请重新选择`, onError);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* ImageUpload                                                          */
/* ------------------------------------------------------------------ */

export interface ImageUploadProps {
  value?: FileValue[] | null;
  onChange?: (files: FileValue[]) => void;
  /** Default 9. */
  maxCount?: number;
  /** Per-image limit in MB (default 2). */
  maxSizeMb?: number;
  accept?: string;
  disabled?: boolean;
  /** View mode: thumbnails only (「-」 when empty). */
  readOnly?: boolean;
  /** Tile size in px (default 88). */
  size?: number;
  buttonText?: string;
  /** Replace the default toast for validation messages. */
  onError?: (message: string) => void;
  className?: string;
}

export function ImageUpload({
  value,
  onChange,
  maxCount = 9,
  maxSizeMb = 2,
  accept = IMAGE_ACCEPT,
  disabled = false,
  readOnly = false,
  size = 88,
  buttonText = "上传图片",
  onError,
  className,
}: ImageUploadProps) {
  const files = value ?? [];
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [reading, setReading] = useState(0);
  const [dragging, setDragging] = useState(false);
  const canAdd = !readOnly && files.length + reading < maxCount;

  async function addFiles(picked: File[]) {
    if (picked.length === 0 || disabled || readOnly) return;
    setReading(picked.length);
    const next = await acceptFiles({
      picked,
      existingCount: files.length,
      maxCount,
      maxSizeMb,
      accept,
      kindLabel: "图片",
      onError,
    });
    setReading(0);
    if (next.length > 0) onChange?.([...files, ...next]);
  }

  if (readOnly && files.length === 0) {
    return <span className={cn("text-text-tertiary", className)}>-</span>;
  }

  const tileStyle = { width: size, height: size };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {files.map((file, index) => (
        <div
          key={file.uid}
          className="group relative overflow-hidden rounded-lg border border-border bg-[#fafafa]"
          style={tileStyle}
        >
          <img src={file.url} alt={file.name} className="size-full object-cover" draggable={false} />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
            <button
              type="button"
              aria-label={`预览 ${file.name}`}
              title="预览"
              className="inline-flex size-7 items-center justify-center rounded-md text-white hover:bg-white/20"
              onClick={() => setPreviewIndex(index)}
            >
              <Eye className="size-4" />
            </button>
            {!readOnly && !disabled ? (
              <button
                type="button"
                aria-label={`删除 ${file.name}`}
                title="删除"
                className="inline-flex size-7 items-center justify-center rounded-md text-white hover:bg-white/20"
                onClick={() => onChange?.(files.filter((item) => item.uid !== file.uid))}
              >
                <Trash2 className="size-4" />
              </button>
            ) : null}
          </div>
        </div>
      ))}
      {Array.from({ length: reading }, (_, index) => (
        <div
          key={`reading-${index}`}
          className="flex items-center justify-center rounded-lg border border-dashed border-border-strong bg-[#fafafa]"
          style={tileStyle}
        >
          <span className="size-5 animate-spin rounded-full border-2 border-brand border-r-transparent" />
        </div>
      ))}
      {canAdd ? (
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed bg-[#fafafa] text-xs text-text-secondary transition-colors duration-150",
            disabled
              ? "cursor-not-allowed border-border-strong text-text-placeholder"
              : "border-border-strong hover:border-brand hover:text-brand",
            dragging && "border-brand bg-brand-soft text-brand",
          )}
          style={tileStyle}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event: DragEvent<HTMLButtonElement>) => {
            event.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event: DragEvent<HTMLButtonElement>) => {
            event.preventDefault();
            setDragging(false);
            void addFiles(Array.from(event.dataTransfer.files));
          }}
        >
          <Plus className="size-5" strokeWidth={1.6} />
          <span>{buttonText}</span>
        </button>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={maxCount > 1}
        className="hidden"
        tabIndex={-1}
        onChange={(event) => {
          const picked = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          void addFiles(picked);
        }}
      />
      <ImagePreview images={files} index={previewIndex} onIndexChange={setPreviewIndex} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AttachmentUpload                                                     */
/* ------------------------------------------------------------------ */

export interface AttachmentUploadProps {
  value?: FileValue[] | null;
  onChange?: (files: FileValue[]) => void;
  /** Default 9. */
  maxCount?: number;
  /** Per-file limit in MB (default 10). */
  maxSizeMb?: number;
  accept?: string;
  disabled?: boolean;
  /** View mode: list with preview / download only. */
  readOnly?: boolean;
  buttonText?: string;
  /** Hint beside the button (default 「最多 N 个，单个不超过 X MB」). */
  hint?: ReactNode;
  onError?: (message: string) => void;
  className?: string;
}

export function AttachmentUpload({
  value,
  onChange,
  maxCount = 9,
  maxSizeMb = 10,
  accept,
  disabled = false,
  readOnly = false,
  buttonText = "上传附件",
  hint,
  onError,
  className,
}: AttachmentUploadProps) {
  const files = value ?? [];
  const inputRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [imageIndex, setImageIndex] = useState<number | null>(null);
  const [previewFile, setPreviewFile] = useState<FileValue | null>(null);
  const images = files.filter(isImageFile);

  async function addFiles(picked: File[]) {
    if (picked.length === 0 || disabled || readOnly) return;
    setReading(true);
    const next = await acceptFiles({
      picked,
      existingCount: files.length,
      maxCount,
      maxSizeMb,
      accept,
      kindLabel: "附件",
      onError,
    });
    setReading(false);
    if (next.length > 0) onChange?.([...files, ...next]);
  }

  function open(file: FileValue) {
    if (isImageFile(file)) setImageIndex(images.findIndex((item) => item.uid === file.uid));
    else if (isPdfFile(file)) setPreviewFile(file);
    else downloadFileValue(file);
  }

  if (readOnly && files.length === 0) {
    return <span className={cn("text-text-tertiary", className)}>-</span>;
  }

  return (
    <div className={cn("min-w-0", className)}>
      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            variant="outline"
            icon={<Upload />}
            disabled={disabled || files.length >= maxCount}
            loading={reading}
            onClick={() => inputRef.current?.click()}
          >
            {buttonText}
          </Button>
          <span className="text-xs text-text-tertiary">
            {hint ?? `最多 ${maxCount} 个，单个不超过 ${maxSizeMb}MB`}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={maxCount > 1}
            className="hidden"
            tabIndex={-1}
            onChange={(event) => {
              const picked = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              void addFiles(picked);
            }}
          />
        </div>
      ) : null}
      {files.length > 0 ? (
        <ul className={cn("flex flex-col gap-1", !readOnly && "mt-2")}>
          {files.map((file) => {
            const Icon = isImageFile(file) ? ImageIcon : isPdfFile(file) ? FileText : Paperclip;
            const viewable = isImageFile(file) || isPdfFile(file);
            return (
              <li
                key={file.uid}
                className="group flex min-w-0 items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-fill-hover"
              >
                <Icon className="size-4 shrink-0 text-text-tertiary" />
                <button
                  type="button"
                  title={viewable ? "预览" : "下载"}
                  className="min-w-0 flex-1 truncate text-left text-sm text-brand hover:text-brand-hover"
                  onClick={() => open(file)}
                >
                  {file.name}
                </button>
                {file.size !== undefined ? (
                  <span className="shrink-0 text-xs tabular-nums text-text-tertiary">{formatFileSize(file.size)}</span>
                ) : null}
                <button
                  type="button"
                  aria-label={`下载 ${file.name}`}
                  title="下载"
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-text-tertiary hover:bg-fill-active hover:text-brand"
                  onClick={() => downloadFileValue(file)}
                >
                  <Download className="size-3.5" />
                </button>
                {!readOnly && !disabled ? (
                  <button
                    type="button"
                    aria-label={`删除 ${file.name}`}
                    title="删除"
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-text-tertiary hover:bg-danger-soft hover:text-danger"
                    onClick={() => onChange?.(files.filter((item) => item.uid !== file.uid))}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      <ImagePreview images={images} index={imageIndex} onIndexChange={setImageIndex} />
      <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ImageThumbs                                                          */
/* ------------------------------------------------------------------ */

export interface ImageThumbsProps {
  value?: FileValue[] | null;
  /** Thumbnail size in px (default 32). */
  size?: number;
  /** Thumbnails before 「+N」 (default 3). */
  max?: number;
  emptyText?: ReactNode;
  className?: string;
}

/** ImageThumbs — list-cell thumbnails; click opens the image viewer. */
export function ImageThumbs({ value, size = 32, max = 3, emptyText = "-", className }: ImageThumbsProps) {
  const images = (value ?? []).filter(isImageFile);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  if (images.length === 0) return <span className={cn("text-text-tertiary", className)}>{emptyText}</span>;
  const shown = images.slice(0, max);
  const rest = images.length - shown.length;
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {shown.map((image, index) => (
        <button
          type="button"
          key={image.uid}
          aria-label={`预览 ${image.name}`}
          className="shrink-0 overflow-hidden rounded-sm border border-border transition-[box-shadow] hover:shadow-[0_0_0_2px_var(--tier0-primary-bg-hover)]"
          style={{ width: size, height: size }}
          onClick={(event) => {
            event.stopPropagation();
            setPreviewIndex(index);
          }}
        >
          <img src={image.url} alt={image.name} className="size-full object-cover" draggable={false} />
        </button>
      ))}
      {rest > 0 ? (
        <button
          type="button"
          aria-label={`查看全部 ${images.length} 张图片`}
          className="inline-flex shrink-0 items-center justify-center rounded-sm bg-fill-active text-xs text-text-secondary hover:text-brand"
          style={{ width: size, height: size }}
          onClick={(event) => {
            event.stopPropagation();
            setPreviewIndex(max);
          }}
        >
          +{rest}
        </button>
      ) : null}
      <ImagePreview images={images} index={previewIndex} onIndexChange={setPreviewIndex} />
    </span>
  );
}

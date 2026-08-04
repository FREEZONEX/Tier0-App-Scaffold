"use client";

import { FileText, Upload, X } from "lucide-react";
import {
  useId,
  useRef,
  useState,
  type DragEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FileUploadLabels {
  dropPrompt: string;
  browse: string;
  selectedFiles: string;
  removeFile: string;
  rejectedFiles: string;
}

export interface FileUploadProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "children" | "defaultValue" | "onChange" | "type" | "value"
  > {
  files?: readonly File[];
  defaultFiles?: readonly File[];
  onFilesChange?: (files: File[]) => void;
  onRejectedFiles?: (files: File[]) => void;
  maxFiles?: number;
  maxSizeBytes?: number;
  hint?: ReactNode;
  error?: ReactNode;
  labels?: Partial<FileUploadLabels>;
  dropzoneClassName?: string;
}

const DEFAULT_LABELS: FileUploadLabels = {
  dropPrompt: "Drop files here",
  browse: "Choose files",
  selectedFiles: "Selected files",
  removeFile: "Remove file",
  rejectedFiles: "Some files do not match the allowed type, size, or count.",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function matchesAccept(file: File, accept?: string): boolean {
  if (!accept?.trim()) return true;

  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();

  return accept.split(",").some((rawToken) => {
    const token = rawToken.trim().toLowerCase();
    if (!token) return false;
    if (token.startsWith(".")) return fileName.endsWith(token);
    if (token.endsWith("/*")) return fileType.startsWith(token.slice(0, -1));
    return fileType === token;
  });
}

export function FileUpload({
  files,
  defaultFiles = [],
  onFilesChange,
  onRejectedFiles,
  maxFiles,
  maxSizeBytes,
  hint,
  error,
  labels,
  dropzoneClassName,
  className,
  id,
  accept,
  multiple = false,
  disabled = false,
  required = false,
  ...inputProps
}: FileUploadProps) {
  const generatedId = useId();
  const inputId = id ?? `file-upload-${generatedId}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalFiles, setInternalFiles] = useState<File[]>([
    ...defaultFiles,
  ]);
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const selectedFiles = files ? [...files] : internalFiles;
  const copy = { ...DEFAULT_LABELS, ...labels };
  const visibleError = error ?? validationError;
  const describedBy = [
    inputProps["aria-describedby"],
    hintId,
    visibleError ? errorId : undefined,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  function syncInputFiles(nextFiles: readonly File[]) {
    if (!inputRef.current || typeof DataTransfer === "undefined") return;
    const transfer = new DataTransfer();
    nextFiles.forEach((file) => transfer.items.add(file));
    inputRef.current.files = transfer.files;
  }

  function commitFiles(nextFiles: File[]) {
    if (files === undefined) setInternalFiles(nextFiles);
    syncInputFiles(nextFiles);
    onFilesChange?.(nextFiles);
  }

  function validateFiles(candidates: File[]) {
    const allowedCount = multiple ? (maxFiles ?? candidates.length) : 1;
    const accepted: File[] = [];
    const rejected: File[] = [];

    candidates.forEach((file) => {
      const withinCount = accepted.length < allowedCount;
      const withinSize = maxSizeBytes === undefined || file.size <= maxSizeBytes;
      if (withinCount && withinSize && matchesAccept(file, accept)) {
        accepted.push(file);
      } else {
        rejected.push(file);
      }
    });

    setValidationError(rejected.length > 0 ? copy.rejectedFiles : null);
    if (rejected.length > 0) onRejectedFiles?.(rejected);
    commitFiles(accepted);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    if (disabled) return;
    validateFiles(Array.from(event.dataTransfer.files));
  }

  function removeFile(index: number) {
    const nextFiles = selectedFiles.filter((_, fileIndex) => fileIndex !== index);
    setValidationError(null);
    commitFiles(nextFiles);
  }

  return (
    <div
      data-file-upload="true"
      className={cn("grid min-w-0 gap-2", className)}
    >
      <input
        {...inputProps}
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        required={required && selectedFiles.length === 0}
        aria-describedby={describedBy}
        aria-invalid={visibleError ? true : undefined}
        className="sr-only"
        onChange={(event) => validateFiles(Array.from(event.currentTarget.files ?? []))}
      />

      <div
        data-drag-active={dragActive ? "true" : "false"}
        className={cn(
          "flex min-h-28 min-w-0 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-input bg-surface-inset px-4 py-5 text-center transition-[border-color,background-color] duration-150",
          "hover:border-border-strong hover:bg-card",
          "data-[drag-active=true]:border-highlight data-[drag-active=true]:bg-highlight-bg-accent",
          disabled && "pointer-events-none opacity-55",
          visibleError && "border-destructive",
          dropzoneClassName,
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setDragActive(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <div className="grid size-9 place-items-center rounded-md border border-border bg-card text-secondary-foreground shadow-sm">
          <Upload className="size-4" aria-hidden="true" />
        </div>
        <div className="grid gap-1">
          <p className="text-sm font-medium text-foreground">{copy.dropPrompt}</p>
          {hint ? (
            <p id={hintId} className="text-xs leading-5 text-muted-foreground">
              {hint}
            </p>
          ) : null}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {copy.browse}
        </Button>
      </div>

      {visibleError ? (
        <p id={errorId} className="text-xs leading-5 text-destructive" role="alert">
          {visibleError}
        </p>
      ) : null}

      {selectedFiles.length > 0 ? (
        <div className="grid gap-1.5" aria-label={copy.selectedFiles}>
          {selectedFiles.map((file, index) => (
            <div
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              className="flex min-w-0 items-center gap-3 rounded-md border border-border bg-card px-3 py-2 shadow-sm"
            >
              <FileText
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {file.name}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <button
                type="button"
                className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-inset hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-55"
                aria-label={`${copy.removeFile}: ${file.name}`}
                disabled={disabled}
                onClick={() => removeFile(index)}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

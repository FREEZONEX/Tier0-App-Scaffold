"use client";

import { useRef } from "react";
import { Upload } from "lucide-react";
import { parseSchemaFile } from "@/hmi/schema/parse-file";
import { useT } from "@/hmi/i18n/context";
import type { Mimic } from "@/hmi/schema/schema";

export function SchemaUpload({
  onLoad,
  onError,
}: {
  onLoad: (mimic: Mimic) => void;
  onError: (message: string) => void;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // 允许重复选择同名文件再次触发
    if (!file) return;
    try {
      const result = parseSchemaFile(await file.text());
      if (result.ok && result.data) onLoad(result.data);
      else onError(result.error ?? t("schema 解析失败"));
    } catch (error: unknown) {
      onError(error instanceof Error ? error.message : t("读取文件失败"));
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleFile}
        data-testid="schema-file-input"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-2 py-1 text-xs text-foreground hover:bg-surface-inset"
        data-testid="upload-schema"
      >
        <Upload className="size-3.5" /> {t("上传 schema")}
      </button>
    </>
  );
}

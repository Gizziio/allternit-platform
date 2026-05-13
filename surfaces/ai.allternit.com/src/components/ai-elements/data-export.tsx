"use client";

import { memo, useCallback } from "react";
import { IconDownload, IconFileTypeCsv, IconJson } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export type ExportableData = Record<string, string | number | boolean | null>[];

export type DataExportProps = {
  data: ExportableData;
  filename?: string;
  className?: string;
};

function toCsv(rows: ExportableData): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          const str = val === null || val === undefined ? "" : String(val);
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    ),
  ];
  return lines.join("\n");
}

function toTsv(rows: ExportableData): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join("\t"),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          return val === null || val === undefined ? "" : String(val);
        })
        .join("\t")
    ),
  ];
  return lines.join("\n");
}

function download(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const DataExport = memo(function DataExport({
  data,
  filename = "export",
  className,
}: DataExportProps) {
  const handleExportCsv = useCallback(() => {
    const csv = toCsv(data);
    download(csv, `${filename}.csv`, "text/csv;charset=utf-8;");
  }, [data, filename]);

  const handleExportTsv = useCallback(() => {
    const tsv = toTsv(data);
    download(tsv, `${filename}.tsv`, "text/tab-separated-values;charset=utf-8;");
  }, [data, filename]);

  const handleExportJson = useCallback(() => {
    const json = JSON.stringify(data, null, 2);
    download(json, `${filename}.json`, "application/json");
  }, [data, filename]);

  if (!data || data.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        onClick={handleExportCsv}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs",
          "border border-border bg-background hover:bg-muted transition-colors",
          "text-foreground"
        )}
        title="Download CSV"
      >
        <IconFileTypeCsv className="size-3.5  text-muted-foreground" />
        CSV
      </button>
      <button
        onClick={handleExportTsv}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs",
          "border border-border bg-background hover:bg-muted transition-colors",
          "text-foreground"
        )}
        title="Download TSV"
      >
        <IconFileTypeCsv className="size-3.5  text-muted-foreground" />
        TSV
      </button>
      <button
        onClick={handleExportJson}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs",
          "border border-border bg-background hover:bg-muted transition-colors",
          "text-foreground"
        )}
        title="Download JSON"
      >
        <IconJson className="size-3.5  text-muted-foreground" />
        JSON
      </button>
    </div>
  );
});

export type DataExportToolbarProps = {
  data: ExportableData;
  filename?: string;
  title?: string;
  className?: string;
};

export const DataExportToolbar = memo(function DataExportToolbar({
  data,
  filename,
  title = "Data",
  className,
}: DataExportToolbarProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-3 py-2 rounded-an-tool-border-radius",
        "border border-border bg-an-tool-background",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <IconDownload className="size-4  text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">
          {data.length} row{data.length !== 1 ? "s" : ""}
        </span>
      </div>
      <DataExport data={data} filename={filename} />
    </div>
  );
});

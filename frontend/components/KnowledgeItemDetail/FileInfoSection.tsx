"use client";

import { SectionLabel } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Download } from "lucide-react";
import { formatFileSize } from "./file-helpers";

interface FileInfoSectionProps {
  filename: string | undefined;
  fileType: string | undefined;
  fileSizeBytes: number | undefined;
  onDownload: () => void;
  isDownloading: boolean;
}

export function FileInfoSection({
  filename,
  fileType,
  fileSizeBytes,
  onDownload,
  isDownloading,
}: FileInfoSectionProps) {
  return (
    <div>
      <SectionLabel className="mb-2">File Information</SectionLabel>
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 sm:flex-1">
          <div className="col-span-2 sm:col-span-1">
            <span className="text-xs text-muted-foreground">Filename</span>
            <p className="font-medium mt-0.5 truncate">
              {filename || "Unknown"}
            </p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">File Type</span>
            <p className="font-medium mt-0.5">
              {fileType?.toUpperCase() || "Unknown"}
            </p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">File Size</span>
            <p className="font-medium mt-0.5">{formatFileSize(fileSizeBytes)}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onDownload}
          disabled={isDownloading}
          className="w-full sm:w-auto"
        >
          {isDownloading ? (
            <Spinner size="sm" className="mr-1.5" />
          ) : (
            <Download className="mr-1.5 h-4 w-4" />
          )}
          {isDownloading ? "Downloading..." : "Download"}
        </Button>
      </div>
    </div>
  );
}

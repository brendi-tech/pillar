"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { KnowledgeItem } from "@/types/knowledge";
import { Check, Copy, Download } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  formatFileSize,
  getFileIcon,
  getFileViewType,
  FileViewType,
} from "./file-helpers";

interface ContentPreviewCardProps {
  item: KnowledgeItem;
  isDocumentUpload: boolean;
  downloadUrl: string | null;
  isLoadingDownloadUrl: boolean;
  fileType?: string;
  originalFilename?: string;
  fileSizeBytes?: number;
  onDownload: () => void;
  isDownloading: boolean;
  onRequestDownloadUrl?: () => void;
}

export function ContentPreviewCard({
  item,
  isDocumentUpload,
  downloadUrl,
  isLoadingDownloadUrl,
  fileType,
  originalFilename,
  fileSizeBytes,
  onDownload,
  isDownloading,
  onRequestDownloadUrl,
}: ContentPreviewCardProps) {
  const [activeContentTab, setActiveContentTab] = useState<
    "optimized" | "original"
  >("optimized");
  const [copied, setCopied] = useState(false);

  const fileViewType: FileViewType = getFileViewType(fileType);

  useEffect(() => {
    if (item?.id) {
      setActiveContentTab(item.optimized_content ? "optimized" : "original");
    }
  }, [item?.id, item?.optimized_content]);

  useEffect(() => {
    if (activeContentTab === "original" && isDocumentUpload && !downloadUrl) {
      onRequestDownloadUrl?.();
    }
  }, [activeContentTab, isDocumentUpload, downloadUrl, onRequestDownloadUrl]);

  const handleCopy = useCallback(() => {
    const content =
      activeContentTab === "optimized"
        ? item.optimized_content
        : item.raw_content;
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  }, [activeContentTab, item.optimized_content, item.raw_content]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Content Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs
          value={activeContentTab}
          onValueChange={(value) =>
            setActiveContentTab(value as "optimized" | "original")
          }
        >
          <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger
                value="optimized"
                disabled={!item.optimized_content}
                className="flex-1 sm:flex-none"
              >
                Optimized
                {item.optimized_content && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    AI
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="original"
                disabled={!item.raw_content && !isDocumentUpload}
                className="flex-1 sm:flex-none"
              >
                Original
              </TabsTrigger>
            </TabsList>
            {!(activeContentTab === "original" && isDocumentUpload) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={
                  activeContentTab === "optimized"
                    ? !item.optimized_content
                    : !item.raw_content
                }
                className="w-full sm:w-auto"
              >
                {copied ? (
                  <Check className="mr-1.5 h-4 w-4" />
                ) : (
                  <Copy className="mr-1.5 h-4 w-4" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            )}
          </div>

          <TabsContent value="optimized">
            <ScrollArea className="h-[50vh] min-h-[300px] max-h-[500px] w-full rounded-md border bg-muted/30 p-4">
              <pre className="whitespace-pre-wrap text-sm font-mono break-words">
                {item.optimized_content || "No optimized content available"}
              </pre>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="original">
            {isDocumentUpload ? (
              <DocumentOriginalContent
                downloadUrl={downloadUrl}
                isLoadingDownloadUrl={isLoadingDownloadUrl}
                fileViewType={fileViewType}
                fileType={fileType}
                originalFilename={originalFilename}
                fileSizeBytes={fileSizeBytes}
                onDownload={onDownload}
                isDownloading={isDownloading}
              />
            ) : (
              <ScrollArea className="h-[60vh] min-h-[400px] max-h-[800px] w-full rounded-md border bg-muted/30 p-4">
                <pre className="whitespace-pre-wrap text-sm font-mono break-words">
                  {item.raw_content || "No original content available"}
                </pre>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface DocumentOriginalContentProps {
  downloadUrl: string | null;
  isLoadingDownloadUrl: boolean;
  fileViewType: FileViewType;
  fileType?: string;
  originalFilename?: string;
  fileSizeBytes?: number;
  onDownload: () => void;
  isDownloading: boolean;
}

function DocumentOriginalContent({
  downloadUrl,
  isLoadingDownloadUrl,
  fileViewType,
  fileType,
  originalFilename,
  fileSizeBytes,
  onDownload,
  isDownloading,
}: DocumentOriginalContentProps) {
  if (isLoadingDownloadUrl) {
    return (
      <div className="h-[60vh] min-h-[400px] max-h-[800px] w-full rounded-md border bg-muted/30 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (fileViewType === "pdf" && downloadUrl) {
    return (
      <div className="h-[60vh] min-h-[400px] max-h-[800px] w-full rounded-md border bg-muted/30">
        <iframe
          src={downloadUrl}
          className="h-full w-full rounded-md"
          title={originalFilename || "PDF Document"}
        />
      </div>
    );
  }

  if (fileViewType === "image" && downloadUrl) {
    return (
      <div className="h-[60vh] min-h-[400px] max-h-[800px] w-full rounded-md border bg-muted/30 flex items-center justify-center p-4 overflow-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={downloadUrl}
          alt={originalFilename || "Image"}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }

  const FileIcon = getFileIcon(fileType);

  return (
    <div className="h-[60vh] min-h-[400px] max-h-[800px] w-full rounded-md border bg-muted/30 flex flex-col items-center justify-center gap-4 p-4 sm:p-8">
      <FileIcon className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground" />
      <div className="text-center">
        <p className="font-medium break-all px-2">
          {originalFilename || "Document"}
        </p>
        <p className="text-sm text-muted-foreground">
          {fileType?.toUpperCase()} · {formatFileSize(fileSizeBytes)}
        </p>
      </div>
      <p className="text-sm text-muted-foreground text-center">
        Download to view the original file
      </p>
      <Button
        onClick={onDownload}
        disabled={isLoadingDownloadUrl || isDownloading}
        className="w-full sm:w-auto"
      >
        {isLoadingDownloadUrl || isDownloading ? (
          <Spinner size="sm" className="mr-2" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        {isDownloading ? "Downloading..." : "Download Original"}
      </Button>
    </div>
  );
}

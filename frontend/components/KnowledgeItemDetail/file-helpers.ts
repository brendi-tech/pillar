import {
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
} from "lucide-react";

export const VIEWABLE_IMAGE_TYPES = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
export const VIEWABLE_PDF_TYPES = ["pdf"];

export type FileViewType = "pdf" | "image" | "download" | "text";

export function getFileViewType(fileType: string | undefined): FileViewType {
  if (!fileType) return "text";
  const type = fileType.toLowerCase();
  if (VIEWABLE_PDF_TYPES.includes(type)) return "pdf";
  if (VIEWABLE_IMAGE_TYPES.includes(type)) return "image";
  return "download";
}

export function getFileIcon(fileType: string | undefined) {
  if (!fileType) return FileText;
  const type = fileType.toLowerCase();
  if (VIEWABLE_PDF_TYPES.includes(type)) return FileType;
  if (VIEWABLE_IMAGE_TYPES.includes(type)) return FileImage;
  if (["xlsx", "xls", "csv"].includes(type)) return FileSpreadsheet;
  if (["docx", "doc"].includes(type)) return FileText;
  return File;
}

export function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

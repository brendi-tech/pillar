'use client';

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import {
  Upload,
  FileText,
  FileType,
  X,
  CheckCircle,
  AlertCircle,
  RotateCw,
} from 'lucide-react';
import { uploadDocument } from '@/lib/admin/sources-api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DocumentUploadZoneProps {
  sourceId: string;
  onUploadComplete?: () => void;
  className?: string;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
  error?: string;
}

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.md', '.txt'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

function getFileExtension(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return ext;
}

function isFileSupported(file: File): boolean {
  const ext = getFileExtension(file.name);
  return SUPPORTED_EXTENSIONS.includes(ext);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(filename: string) {
  const ext = getFileExtension(filename);
  if (ext === '.pdf') return FileText;
  if (['.docx', '.doc'].includes(ext)) return FileType;
  return FileText;
}

export function DocumentUploadZone({
  sourceId,
  onUploadComplete,
  className,
}: DocumentUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const validFiles: File[] = [];
      const errors: string[] = [];

      // Validate files
      for (const file of fileArray) {
        if (!isFileSupported(file)) {
          errors.push(`${file.name}: Unsupported file type`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          errors.push(`${file.name}: File too large (max 100 MB)`);
          continue;
        }
        validFiles.push(file);
      }

      // Show validation errors
      if (errors.length > 0) {
        errors.forEach((err) => toast.error(err));
      }

      if (validFiles.length === 0) return;

      // Add files to uploading state
      const newUploadingFiles: UploadingFile[] = validFiles.map((file) => ({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        progress: 0,
        status: 'uploading' as const,
      }));

      setUploadingFiles((prev) => [...prev, ...newUploadingFiles]);

      // Upload files
      for (const uploadingFile of newUploadingFiles) {
        try {
          // Simulate progress (real progress would need XHR)
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.id === uploadingFile.id ? { ...f, progress: 30 } : f
            )
          );

          await uploadDocument(sourceId, uploadingFile.file);

          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.id === uploadingFile.id
                ? { ...f, progress: 100, status: 'complete' as const }
                : f
            )
          );

          toast.success(`Uploaded ${uploadingFile.file.name}`);
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : 'Upload failed';
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.id === uploadingFile.id
                ? { ...f, status: 'error' as const, error: errorMsg }
                : f
            )
          );
          toast.error(`Failed to upload ${uploadingFile.file.name}: ${errorMsg}`);
        }
      }

      // Notify parent
      onUploadComplete?.();
    },
    [sourceId, onUploadComplete]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
        // Reset input so the same file can be uploaded again if needed
        e.target.value = '';
      }
    },
    [handleFiles]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const removeFile = useCallback((id: string) => {
    setUploadingFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const retryUpload = useCallback(
    async (uploadingFile: UploadingFile) => {
      // Reset status to uploading
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.id === uploadingFile.id
            ? { ...f, status: 'uploading' as const, progress: 0, error: undefined }
            : f
        )
      );

      try {
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.id === uploadingFile.id ? { ...f, progress: 30 } : f
          )
        );

        await uploadDocument(sourceId, uploadingFile.file);

        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.id === uploadingFile.id
              ? { ...f, progress: 100, status: 'complete' as const }
              : f
          )
        );

        toast.success(`Uploaded ${uploadingFile.file.name}`);
        onUploadComplete?.();
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Upload failed';
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.id === uploadingFile.id
              ? { ...f, status: 'error' as const, error: errorMsg }
              : f
          )
        );
        toast.error(`Failed to upload ${uploadingFile.file.name}: ${errorMsg}`);
      }
    },
    [sourceId, onUploadComplete]
  );

  const hasActiveUploads = uploadingFiles.some((f) => f.status === 'uploading');

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop Zone */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={SUPPORTED_EXTENSIONS.join(',')}
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-2">
          <div
            className={cn(
              'rounded-full p-3 transition-colors',
              isDragOver ? 'bg-primary/10' : 'bg-muted'
            )}
          >
            <Upload
              className={cn(
                'h-6 w-6',
                isDragOver ? 'text-primary' : 'text-muted-foreground'
              )}
            />
          </div>
          <div>
            <p className="font-medium">
              {isDragOver ? 'Drop files here' : 'Drag and drop files here'}
            </p>
            <p className="text-sm text-muted-foreground">
              or click to browse
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Supported: PDF, DOCX, DOC, MD, TXT (max 100 MB)
          </p>
        </div>
      </div>

      {/* Upload Progress */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Uploads</h4>
          <div className="space-y-2">
            {uploadingFiles.map((file) => {
              const FileIcon = getFileIcon(file.file.name);
              return (
                <div
                  key={file.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <FileIcon className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {file.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.file.size)}
                    </p>
                    {file.status === 'uploading' && (
                      <Progress value={file.progress} className="mt-1 h-1" />
                    )}
                    {file.status === 'error' && (
                      <p className="text-xs text-red-600 mt-1">{file.error}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {file.status === 'uploading' && (
                      <Spinner className="h-4 w-4" />
                    )}
                    {file.status === 'complete' && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                    {file.status === 'error' && (
                      <>
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => retryUpload(file)}
                          title="Retry upload"
                        >
                          <RotateCw className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {file.status !== 'uploading' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeFile(file.id)}
                        title="Remove"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Clear completed button */}
      {uploadingFiles.length > 0 && !hasActiveUploads && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setUploadingFiles([])}
        >
          Clear completed
        </Button>
      )}
    </div>
  );
}

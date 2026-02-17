'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type {
  KnowledgeCrawlConfig,
  KnowledgeSourceTypeOption,
  ConnectionConfig,
} from '@/types/knowledge';
import type { PendingUpload } from '@/types/sources';
import { 
  ArrowLeft, 
  Check, 
  FileText, 
  Globe, 
  HelpCircle,
  Plug,
  Cloud,
  Upload,
  BookOpen,
  FileType,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

interface ReviewAndCreateProps {
  sourceType: KnowledgeSourceTypeOption;
  name: string;
  url: string;
  crawlConfig: KnowledgeCrawlConfig;
  connectionConfig?: ConnectionConfig;
  pendingUploads?: PendingUpload[];
  onBack: () => void;
  onCreate: () => void;
  onNameChange?: (name: string) => void;
  isSubmitting: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(filename: string) {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  if (ext === '.pdf') return FileText;
  if (['.docx', '.doc'].includes(ext)) return FileType;
  return FileText;
}

const iconMap: Record<string, typeof Globe> = {
  HelpCircle: HelpCircle,
  Globe: Globe,
  FileText: FileText,
  BookOpen: BookOpen,
  Plug: Plug,
  Cloud: Cloud,
  Upload: Upload,
};

// Source types that skip the config step and need inline name editing
const SIMPLE_SOURCE_TYPES = ['snippets'];

export function ReviewAndCreate({
  sourceType,
  name,
  url,
  crawlConfig,
  connectionConfig,
  pendingUploads = [],
  onBack,
  onCreate,
  onNameChange,
  isSubmitting,
}: ReviewAndCreateProps) {
  const Icon = iconMap[sourceType.icon] || Globe;
  const isSimpleType = SIMPLE_SOURCE_TYPES.includes(sourceType.id);
  const isValid = name.trim() !== '';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">
          {isSimpleType ? `Create ${sourceType.name}` : 'Review & Create'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isSimpleType 
            ? `Set up your new ${sourceType.name.toLowerCase()} source.`
            : 'Confirm the details of your new knowledge source.'}
        </p>
      </div>

      {/* Editable name for simple source types */}
      {isSimpleType && onNameChange && (
        <div className="space-y-2">
          <Label htmlFor="sourceName">Name</Label>
          <Input
            id="sourceName"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={sourceType.name}
          />
          <p className="text-xs text-muted-foreground">
            A friendly name to identify this source.
          </p>
        </div>
      )}

      <div className="rounded-lg border p-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="flex-1 space-y-1">
            {!isSimpleType && <h3 className="font-semibold">{name}</h3>}
            <p className={isSimpleType ? "font-medium" : "text-sm text-muted-foreground"}>
              {sourceType.name}
            </p>
            {isSimpleType && (
              <p className="text-sm text-muted-foreground">{sourceType.description}</p>
            )}
          </div>
        </div>

        {/* URL-based sources (help_center, marketing_site) */}
        {sourceType.requiresUrl && (
          <dl className="mt-4 space-y-3 border-t pt-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">URL</dt>
              <dd className="mt-1 text-sm">{url}</dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Max Pages
              </dt>
              <dd className="mt-1 text-sm">{crawlConfig.max_pages || 100}</dd>
            </div>

            {crawlConfig.include_paths && crawlConfig.include_paths.length > 0 && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Include Paths
                </dt>
                <dd className="mt-1 text-sm">
                  {crawlConfig.include_paths.join(', ')}
                </dd>
              </div>
            )}

            {crawlConfig.exclude_paths && crawlConfig.exclude_paths.length > 0 && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Exclude Paths
                </dt>
                <dd className="mt-1 text-sm">
                  {crawlConfig.exclude_paths.join(', ')}
                </dd>
              </div>
            )}
          </dl>
        )}

        {/* Cloud storage sources */}
        {sourceType.requiresCredentials && connectionConfig && (
          <dl className="mt-4 space-y-3 border-t pt-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Provider</dt>
              <dd className="mt-1 text-sm">
                {connectionConfig.provider === 's3' ? 'Amazon S3' : 'Google Cloud Storage'}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-muted-foreground">Bucket</dt>
              <dd className="mt-1 text-sm">{connectionConfig.bucket}</dd>
            </div>

            {connectionConfig.prefix && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Path Prefix
                </dt>
                <dd className="mt-1 text-sm">{connectionConfig.prefix}</dd>
              </div>
            )}

            {connectionConfig.provider === 's3' && connectionConfig.region && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Region
                </dt>
                <dd className="mt-1 text-sm">{connectionConfig.region}</dd>
              </div>
            )}
          </dl>
        )}

        {/* Snippets info */}
        {sourceType.id === 'snippets' && (
          <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">
            After creating this source, you can add custom snippets with specific
            instructions or context for your AI assistant.
          </p>
        )}

        {/* Document upload - show uploaded files */}
        {sourceType.id === 'document_upload' && pendingUploads.length > 0 && (
          <div className="mt-4 border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Files to upload
              </span>
              <span className="text-sm text-muted-foreground">
                {pendingUploads.length} file{pendingUploads.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {pendingUploads.map((upload) => {
                const FileIcon = getFileIcon(upload.filename);
                return (
                  <div
                    key={upload.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <FileIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate flex-1">{upload.filename}</span>
                    <span className="text-muted-foreground text-xs">
                      {formatFileSize(upload.size)}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Files will be processed after the source is created.
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={onCreate} disabled={isSubmitting || (isSimpleType && !isValid)}>
          {isSubmitting ? (
            <Spinner size="sm" className="mr-2" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}
          Create Source
        </Button>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Check, CheckCircle, Cloud, ExternalLink, HelpCircle, XCircle } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import type { ConnectionConfig } from '@/types/sources';
import { testConnection } from '@/lib/admin/sources-api';
import { toast } from 'sonner';

interface CloudStorageFormProps {
  onBack: () => void;
  onSubmit: (data: { name: string; connection_config: ConnectionConfig }) => void;
  isSubmitting?: boolean;
}

const AWS_REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-east-2', label: 'US East (Ohio)' },
  { value: 'us-west-1', label: 'US West (N. California)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-west-1', label: 'Europe (Ireland)' },
  { value: 'eu-west-2', label: 'Europe (London)' },
  { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
];

type CloudProvider = 's3' | 'gcs';

export function CloudStorageForm({ onBack, onSubmit, isSubmitting }: CloudStorageFormProps) {
  const [name, setName] = useState('Cloud Storage Documents');
  const [provider, setProvider] = useState<CloudProvider>('s3');
  const [bucket, setBucket] = useState('');
  const [prefix, setPrefix] = useState('');
  
  // S3 specific
  const [region, setRegion] = useState('us-east-1');
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  
  // GCS specific
  const [credentialsJson, setCredentialsJson] = useState('');
  
  // Connection test state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    valid: boolean;
    error?: string;
    objects_found?: number;
    supported_files?: number;
  } | null>(null);

  const buildConnectionConfig = (): ConnectionConfig => ({
    provider,
    bucket,
    prefix: prefix || undefined,
    ...(provider === 's3'
      ? { region, access_key: accessKey, secret_key: secretKey }
      : { credentials_json: credentialsJson }),
  });

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testConnection(buildConnectionConfig());
      setTestResult(result);
      if (result.valid) {
        toast.success(`Connection successful! Found ${result.supported_files || 0} supported files.`);
      } else {
        toast.error(result.error || 'Connection test failed');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Connection test failed';
      setTestResult({ valid: false, error: errorMsg });
      toast.error(errorMsg);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name: name.trim(), connection_config: buildConnectionConfig() });
  };

  const isS3Valid = bucket && region && accessKey && secretKey;
  const isGcsValid = bucket && credentialsJson;
  const isValid = name.trim() !== '' && (provider === 's3' ? isS3Valid : isGcsValid);

  // #region agent log
  useEffect(() => {
    if (provider === 'gcs') {
      const textarea = document.getElementById('credentialsJson') as HTMLTextAreaElement;
      const form = textarea?.closest('form');
      const scrollableDiv = form?.querySelector('.overflow-y-auto');
      const submitBtn = form?.querySelector('button[type="submit"]');
      if (textarea && form) {
        const formStyles = window.getComputedStyle(form);
        const scrollDivStyles = scrollableDiv ? window.getComputedStyle(scrollableDiv) : null;
        const btnRect = submitBtn?.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        // Check ancestors for overflow:hidden
        const ancestors: {tag:string,overflow:string,height:string}[] = [];
        let el = form.parentElement;
        for(let i=0; i<5 && el; i++) {
          const s = window.getComputedStyle(el);
          ancestors.push({tag:el.tagName,overflow:s.overflow,height:s.height});
          el = el.parentElement;
        }
        fetch('http://127.0.0.1:7242/ingest/7d16d444-caef-4fca-a84f-729299240caa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CloudStorageForm.tsx:useEffect',message:'Deep layout analysis',data:{scrollableDiv:{height:scrollDivStyles?.height,maxHeight:scrollDivStyles?.maxHeight,overflowY:scrollDivStyles?.overflowY,minHeight:scrollDivStyles?.minHeight},form:{height:formStyles.height,maxHeight:formStyles.maxHeight},button:{bottom:btnRect?.bottom,top:btnRect?.top,visible:btnRect?btnRect.bottom<=viewportHeight:null},viewport:viewportHeight,ancestors},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H,I,J'})}).catch(()=>{});
      }
    }
  }, [provider, credentialsJson]);
  // #endregion

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Cloud Storage</h2>
        <p className="text-sm text-muted-foreground">
          Connect to your S3 or Google Cloud Storage bucket to sync documents.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Supported formats: PDF, Word, Excel, PowerPoint, Markdown, Text, CSV, HTML, JSON
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Cloud Documents"
          />
          <p className="text-xs text-muted-foreground">
            A friendly name to identify this source.
          </p>
        </div>

        <div className="space-y-3">
          <Label>Cloud Provider</Label>
          <RadioGroup
            value={provider}
            onValueChange={(value) => {
              setProvider(value as CloudProvider);
              setTestResult(null);
            }}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="s3" id="s3" />
              <Label htmlFor="s3" className="cursor-pointer font-normal">
                Amazon S3
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="gcs" id="gcs" />
              <Label htmlFor="gcs" className="cursor-pointer font-normal">
                Google Cloud Storage
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bucket">Bucket Name</Label>
          <Input
            id="bucket"
            value={bucket}
            onChange={(e) => {
              setBucket(e.target.value);
              setTestResult(null);
            }}
            placeholder={provider === 's3' ? 'my-docs-bucket' : 'my-gcs-bucket'}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prefix">Path Prefix (optional)</Label>
          <Input
            id="prefix"
            value={prefix}
            onChange={(e) => {
              setPrefix(e.target.value);
              setTestResult(null);
            }}
            placeholder="documents/"
          />
          <p className="text-xs text-muted-foreground">
            Only sync files under this path. Leave empty to sync the entire bucket.
          </p>
        </div>

        {provider === 's3' ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="region">AWS Region</Label>
              <Select
                value={region}
                onValueChange={(value) => {
                  setRegion(value);
                  setTestResult(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {AWS_REGIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accessKey">Access Key ID</Label>
              <Input
                id="accessKey"
                value={accessKey}
                onChange={(e) => {
                  setAccessKey(e.target.value);
                  setTestResult(null);
                }}
                placeholder="AKIAIOSFODNN7EXAMPLE"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="secretKey">Secret Access Key</Label>
              <Input
                id="secretKey"
                type="password"
                value={secretKey}
                onChange={(e) => {
                  setSecretKey(e.target.value);
                  setTestResult(null);
                }}
                placeholder="••••••••••••••••"
              />
              <p className="text-xs text-muted-foreground">
                Your credentials are encrypted and stored securely.
              </p>
              <a
                href="/docs/knowledge/s3-setup"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <HelpCircle className="h-3 w-3" />
                How to create AWS access keys
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="credentialsJson">Service Account JSON</Label>
            {/* #region agent log */}
            {(() => { fetch('http://127.0.0.1:7242/ingest/7d16d444-caef-4fca-a84f-729299240caa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CloudStorageForm.tsx:GCS_SECTION',message:'Rendering GCS textarea',data:{credentialsJsonLength:credentialsJson.length,appliedClassName:'font-mono text-xs max-h-[200px] overflow-y-auto resize-none'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,D'})}).catch(()=>{}); return null; })()}
            {/* #endregion */}
            <Textarea
              id="credentialsJson"
              value={credentialsJson}
              onChange={(e) => {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/7d16d444-caef-4fca-a84f-729299240caa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CloudStorageForm.tsx:onChange',message:'Textarea value changed',data:{newLength:e.target.value.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
                // #endregion
                setCredentialsJson(e.target.value);
                setTestResult(null);
              }}
              placeholder='{"type": "service_account", ...}'
              className="font-mono text-xs max-h-[200px] overflow-y-auto resize-none ![field-sizing:fixed]"
              rows={6}
            />
            <p className="text-xs text-muted-foreground">
              Paste your service account JSON credentials. They are encrypted and stored securely.
            </p>
            <a
              href="/docs/knowledge/gcs-setup"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <HelpCircle className="h-3 w-3" />
              How to create a service account
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Test Connection Section */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">Test Connection</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={!isValid || isTesting}
            >
              {isTesting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Testing...
                </>
              ) : (
                'Test'
              )}
            </Button>
          </div>
          {testResult && (
            <div
              className={`mt-3 flex items-center gap-2 text-sm ${
                testResult.valid ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {testResult.valid ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span>
                    Connected! Found {testResult.supported_files || 0} supported files
                    {testResult.objects_found !== undefined &&
                      ` (${testResult.objects_found} total objects)`}
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  <span>{testResult.error || 'Connection failed'}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button type="submit" disabled={!isValid || isSubmitting}>
          {isSubmitting ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Creating...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Create Source
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

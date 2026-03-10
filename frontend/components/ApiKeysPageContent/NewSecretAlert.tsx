"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { CopyButton } from "./CopyButton";
import type { GeneratedSecret } from "./ApiKeysPageContent.types";

interface NewSecretAlertProps {
  generatedSecret: GeneratedSecret;
}

export function NewSecretAlert({ generatedSecret }: NewSecretAlertProps) {
  return (
    <Alert
      variant="default"
      className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/30"
    >
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800 dark:text-amber-200">
        Copy Your &quot;{generatedSecret.name}&quot; Secret Now!
      </AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-300 space-y-2">
        <p>
          This secret will only be shown once. Copy it now and store it
          securely.
        </p>
        <div className="flex items-center gap-2 mt-2">
          <code className="flex-1 rounded bg-background border px-3 py-2 font-mono text-xs break-all">
            {generatedSecret.secret}
          </code>
          <CopyButton value={generatedSecret.secret} />
        </div>
      </AlertDescription>
    </Alert>
  );
}

'use client';

import { useState } from 'react';
import { useConfigure } from './ConfigureContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  Plus, 
  X,
  AlertTriangle,
} from 'lucide-react';

export function SecuritySection() {
  const { embedConfig, updateEmbedConfig } = useConfigure();
  const security = embedConfig.security;
  const [newDomain, setNewDomain] = useState('');
  const [domainError, setDomainError] = useState<string | null>(null);

  const handleRestrictToggle = (restrict: boolean) => {
    updateEmbedConfig({
      security: { ...security, restrictToAllowedDomains: restrict },
    });
  };

  const validateDomain = (domain: string): boolean => {
    // Basic domain validation
    const domainRegex = /^(\*\.)?[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*(\.[a-zA-Z]{2,})?(:\d+)?$/;
    return domainRegex.test(domain) || domain === 'localhost' || domain.startsWith('localhost:');
  };

  const handleAddDomain = () => {
    const domain = newDomain.trim().toLowerCase();
    setDomainError(null);

    if (!domain) {
      setDomainError('Please enter a domain');
      return;
    }

    if (!validateDomain(domain)) {
      setDomainError('Please enter a valid domain (e.g., example.com, *.example.com, localhost:3000)');
      return;
    }

    if (security.allowedDomains.includes(domain)) {
      setDomainError('This domain is already in the list');
      return;
    }

    updateEmbedConfig({
      security: {
        ...security,
        allowedDomains: [...security.allowedDomains, domain],
      },
    });
    setNewDomain('');
  };

  const handleRemoveDomain = (domain: string) => {
    updateEmbedConfig({
      security: {
        ...security,
        allowedDomains: security.allowedDomains.filter((d) => d !== domain),
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddDomain();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Domain Security
        </CardTitle>
        <CardDescription>
          Control which domains can use your embedded SDK
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Restrict Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Restrict to allowed domains</Label>
            <p className="text-xs text-muted-foreground">
              When enabled, the SDK will only work on the domains listed below
            </p>
          </div>
          <Switch
            checked={security.restrictToAllowedDomains}
            onCheckedChange={handleRestrictToggle}
          />
        </div>

        {/* Warning when not restricted */}
        {!security.restrictToAllowedDomains && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="text-xs">
              <p className="font-medium">Domain restrictions are disabled</p>
              <p className="mt-0.5">
                Your SDK can be used on any domain. This is fine for development but 
                consider enabling restrictions for production.
              </p>
            </div>
          </div>
        )}

        {/* Add Domain */}
        <div className="space-y-3">
          <Label>Allowed Domains</Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                value={newDomain}
                onChange={(e) => {
                  setNewDomain(e.target.value);
                  setDomainError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="app.example.com or localhost:3000"
                className={domainError ? 'border-destructive' : ''}
              />
              {domainError && (
                <p className="text-xs text-destructive mt-1">{domainError}</p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleAddDomain}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Use <code className="bg-muted px-1 rounded">*.example.com</code> to allow all subdomains
          </p>
        </div>

        {/* Domain List */}
        {security.allowedDomains.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {security.allowedDomains.map((domain) => (
              <Badge
                key={domain}
                variant="secondary"
                className="gap-1 pl-2.5 pr-1 py-1"
              >
                <span className="font-mono text-xs">{domain}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveDomain(domain)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
            No domains added yet
          </div>
        )}

        {/* Common domains hint */}
        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Common entries:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li><code className="bg-muted px-1 rounded">localhost:3000</code> - Local development</li>
            <li><code className="bg-muted px-1 rounded">staging.yourapp.com</code> - Staging environment</li>
            <li><code className="bg-muted px-1 rounded">app.yourapp.com</code> - Production app</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

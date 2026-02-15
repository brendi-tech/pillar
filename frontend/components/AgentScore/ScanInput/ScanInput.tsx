"use client";

import { useState, useEffect } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ScanInputProps {
  onScan: (url: string) => void;
  isScanning: boolean;
  error?: string;
  /** Pre-fill the URL field (e.g. when re-syncing an existing report). */
  initialUrl?: string;
}

function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!url) return "";
  // Add protocol if missing
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  // Strip trailing slashes
  url = url.replace(/\/+$/, "");
  return url;
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function ScanInput({ onScan, isScanning, error, initialUrl = "" }: ScanInputProps) {
  const [inputValue, setInputValue] = useState(initialUrl);
  const [localError, setLocalError] = useState<string | null>(null);

  // Sync input value when initialUrl prop changes (e.g. domain lookup prefill)
  useEffect(() => {
    if (initialUrl && initialUrl !== inputValue) {
      setInputValue(initialUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl]);

  const displayError = error || localError;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const normalized = normalizeUrl(inputValue);
    if (!normalized) {
      setLocalError("Enter a URL to scan.");
      return;
    }
    if (!isValidUrl(normalized)) {
      setLocalError("That doesn't look like a valid URL.");
      return;
    }

    onScan(normalized);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          type="text"
          placeholder="https://example.com"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setLocalError(null);
          }}
          disabled={isScanning}
          className="h-14 text-lg px-5 bg-white border-[#D4D4D4] placeholder:text-[#999] focus-visible:ring-[#FF6E00]/30 focus-visible:border-[#FF6E00] disabled:opacity-60"
        />
        <Button
          type="submit"
          disabled={isScanning}
          className="h-14 px-8 text-base font-medium bg-[#FF6E00] hover:bg-[#E06200] text-white shrink-0 sm:w-auto w-full"
        >
          {isScanning ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Scanning
            </>
          ) : (
            <>
              Scan
              <ArrowRight className="h-5 w-5 ml-2" />
            </>
          )}
        </Button>
      </div>
      {displayError && (
        <p className="mt-3 text-sm text-[#FF4E42] font-medium">{displayError}</p>
      )}
    </form>
  );
}

"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

interface ReportCTAProps {
  onScanAnother: () => void;
}

export function ReportCTA({ onScanAnother }: ReportCTAProps) {
  return (
    <div className="text-center mt-12 py-10 border-t border-[#E8E4DC]">
      <h3 className="text-xl font-semibold text-[#1A1A1A]">
        Want to improve your score?
      </h3>
      <p className="text-sm text-[#6B6B6B] mt-2 max-w-md mx-auto">
        Pillar adds WebMCP tools to your site in minutes. No code changes
        required.
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
        <Link
          href="/signup"
          className="inline-flex items-center justify-center h-11 px-8 text-base font-medium rounded-lg bg-[#FF6E00] hover:bg-[#E06200] text-white transition-colors"
        >
          Get Started Free
        </Link>
        <Button
          variant="outline"
          onClick={onScanAnother}
          className="h-11 px-8 text-base font-medium border-[#D4D4D4] text-[#1A1A1A] hover:bg-[#F3EFE8]"
        >
          Scan Another
        </Button>
      </div>
    </div>
  );
}

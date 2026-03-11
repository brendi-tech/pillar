"use client";

import Link from "next/link";
import { PillarLogoWithName } from "../marketing/LandingPage/PillarLogoWithName";

/**
 * MarketingFooter - Footer for the marketing page
 * Features logo on left, privacy/terms links on right, and copyright centered below
 */
export function MarketingFooter() {
  return (
    <footer className="bg-[#F3EFE8] h-[282px] flex flex-col">
      <div className="max-w-marketingSection mx-auto border-x border-marketing flex-1 flex flex-col justify-between w-full">
        {/* Top row: Logo and Links */}
        <div className="flex justify-between sm:flex-row flex-col sm:items-center px-6 lg:px-8 pt-6">
          {/* Left: Logo */}
          <Link href="/" className="hover:opacity-90 transition-opacity">
            <PillarLogoWithName className="h-6 w-auto" />
          </Link>

          {/* Right: Links */}
          <div className="flex sm:items-center gap-3 sm:gap-8 pt-4 sm:pt-0 text-sm text-[#1A1A1A] sm:flex-row flex-col">
            <Link
              href="/docs"
              className="hover:text-[#6B6B6B] transition-colors"
            >
              Docs
            </Link>
            <Link
              href="/blog"
              className="hover:text-[#6B6B6B] transition-colors"
            >
              Blog
            </Link>
            <Link
              href="/pricing"
              className="hover:text-[#6B6B6B] transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/contact"
              className="hover:text-[#6B6B6B] transition-colors"
            >
              Contact Us
            </Link>
            <Link
              href="/privacy"
              className="hover:text-[#6B6B6B] transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="hover:text-[#6B6B6B] transition-colors"
            >
              Terms of Use
            </Link>
          </div>
        </div>

        {/* Bottom row: Copyright */}
        <div className="px-6 lg:px-8 pb-8">
          <p className="text-center text-sm text-[#6B6B6B]">
            © {new Date().getFullYear()} Pillar
          </p>
        </div>
      </div>

      {/* Bottom accent bar */}
      <div className="h-2 bg-[#1A1A1A]" />
    </footer>
  );
}

"use client";

import { getAdminSubdomainUrl } from "@/lib/admin/redirect";
import { ArrowRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PillarLogoWithName } from "../marketing/LandingPage/PillarLogoWithName";

const navLinks = [
  { name: "Blog", href: "/blog" },
  { name: "Docs", href: "/docs" },
];

interface MarketingNavbarProps {
  onOpenWaitlist?: () => void;
}

/**
 * MarketingNavbar - Navigation for the new marketing page
 * Features logo on left, nav links (Blog, Docs), Login, and Join Waitlist CTA on right
 */
export function MarketingNavbar({ onOpenWaitlist }: MarketingNavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminUrl, setAdminUrl] = useState("/login");

  useEffect(() => {
    // Set admin URL after mount to avoid hydration mismatch
    setAdminUrl(getAdminSubdomainUrl());

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className="bg-white/80 backdrop-blur-lg sticky top-0 z-50 w-full relative">
      {/* Animated border from center */}
      <div
        className="absolute bottom-0 left-1/2 h-px bg-marketing transition-all duration-500 ease-out"
        style={{
          width: isScrolled ? "100%" : "0%",
          transform: "translateX(-50%)",
        }}
      />
      <div className="max-w-[1334px] mx-auto">
        <div className="flex justify-between items-center h-14 sm:h-16 lg:h-20">
          {/* Left: Logo */}
          <div className="shrink-0">
            <Link href="/" className="hover:opacity-90 transition-opacity">
              <PillarLogoWithName className="h-6 sm:h-7 lg:h-8" />
            </Link>
          </div>

          {/* Right: Nav Links + Login + CTA Button (desktop) */}
          <div className="hidden md:flex items-center gap-6 lg:gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="text-sm sm:text-[0.9375rem] font-medium text-[#1A1A1A] hover:text-[#FF6E00] transition-colors"
              >
                {link.name}
              </Link>
            ))}
            <a
              href={adminUrl}
              className="text-sm sm:text-[0.9375rem] font-medium text-[#1A1A1A] hover:text-[#FF6E00] transition-colors"
            >
              Log In
            </a>
            <button
              onClick={onOpenWaitlist}
              className="inline-flex items-center justify-center h-9 sm:h-10 lg:h-11 px-4 sm:px-5 lg:px-6 text-sm sm:text-[0.9375rem] font-medium rounded-lg bg-[#FF6E00] text-white hover:bg-[#E06200] transition-colors cursor-pointer"
            >
              Join Waitlist
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-[#1A1A1A] hover:text-[#FF6E00] p-2"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 border-t border-[#E5E0D8] bg-white/80 backdrop-blur-lg">
            <div className="flex flex-col space-y-1 pt-4">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="py-2 text-[#1A1A1A] hover:text-[#FF6E00] transition-colors font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.name}
                </Link>
              ))}
              <a
                href={adminUrl}
                className="py-2 text-[#1A1A1A] hover:text-[#FF6E00] transition-colors font-medium"
              >
                Log In
              </a>
              <div className="pt-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenWaitlist?.();
                  }}
                  className="inline-flex items-center justify-center h-10 px-6 text-sm font-medium rounded-lg bg-[#FF6E00] text-white hover:bg-[#E06200] transition-colors w-full cursor-pointer"
                >
                  Join Waitlist
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Gradient bottom border */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[1px]"
        style={{
          background: "linear-gradient(90deg, rgba(212,212,212,0) 0%, #D4D4D4 30%, #D4D4D4 70%, rgba(212,212,212,0) 100%)",
        }}
      />
    </nav>
  );
}

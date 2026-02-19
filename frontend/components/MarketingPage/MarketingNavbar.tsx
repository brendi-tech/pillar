"use client";

import { Menu, X, ChevronDown, Gauge, LayoutDashboard, BarChart3 } from "lucide-react";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.97616 2C5.56555 2 2 5.59184 2 10.0354C2 13.5874 4.28457 16.5941 7.45388 17.6583C7.85012 17.7383 7.99527 17.4854 7.99527 17.2727C7.99527 17.0864 7.9822 16.4478 7.9822 15.7825C5.76343 16.2616 5.30139 14.8247 5.30139 14.8247C4.94482 13.8934 4.41649 13.654 4.41649 13.654C3.69029 13.1618 4.46939 13.1618 4.46939 13.1618C5.27494 13.215 5.69763 13.9866 5.69763 13.9866C6.41061 15.2104 7.55951 14.8647 8.02171 14.6518C8.08767 14.1329 8.2991 13.7737 8.52359 13.5742C6.75396 13.3879 4.89208 12.6962 4.89208 9.60963C4.89208 8.73159 5.20882 8.01322 5.71069 7.45453C5.63151 7.25502 5.35412 6.43004 5.79004 5.32588C5.79004 5.32588 6.46351 5.11298 7.98204 6.15069C8.63218 5.9748 9.30265 5.88532 9.97616 5.88457C10.6496 5.88457 11.3362 5.9778 11.9701 6.15069C13.4888 5.11298 14.1623 5.32588 14.1623 5.32588C14.5982 6.43004 14.3207 7.25502 14.2415 7.45453C14.7566 8.01322 15.0602 8.73159 15.0602 9.60963C15.0602 12.6962 13.1984 13.3745 11.4155 13.5742C11.7061 13.8269 11.9569 14.3058 11.9569 15.0642C11.9569 16.1417 11.9438 17.0065 11.9438 17.2725C11.9438 17.4854 12.0891 17.7383 12.4852 17.6584C15.6545 16.594 17.9391 13.5874 17.9391 10.0354C17.9522 5.59184 14.3736 2 9.97616 2Z"
      />
    </svg>
  );
}
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PillarLogoWithName } from "../marketing/LandingPage/PillarLogoWithName";

const GITHUB_URL = "https://github.com/pillarhq/pillar";

const resourcesDropdownItems = [
  {
    name: "Agent Readiness Score",
    description: "Agents are coming.  Is your site ready?",
    href: "/resources/agent-score",
    icon: Gauge,
  },
];

const demosDropdownItems = [
  {
    name: "Grafana Copilot",
    description: "AI copilot embedded in Grafana dashboards.",
    href: "/demos/grafana",
    icon: LayoutDashboard,
  },
  {
    name: "Superset Copilot",
    description: "AI copilot embedded in Apache Superset.",
    href: "/demos/superset",
    icon: BarChart3,
  },
];

type DropdownType = "resources" | "demos";

type NavLink =
  | { name: string; href: string; dropdown?: undefined }
  | { name: string; dropdown: DropdownType; href?: undefined };

const navLinks: NavLink[] = [
  { name: "Home", href: "/" },
  { name: "Resources", dropdown: "resources" },
  { name: "Demos", dropdown: "demos" },
  { name: "Blog", href: "/blog" },
  { name: "Pricing", href: "/pricing" },
  { name: "Docs", href: "/docs" },
];

const dropdownItemsMap: Record<DropdownType, typeof resourcesDropdownItems> = {
  resources: resourcesDropdownItems,
  demos: demosDropdownItems,
};

/**
 * MarketingNavbar - Navigation for the marketing site
 * 3-column layout: logo left, centered nav links, right-side actions (GitHub, Login, Get Started)
 */
export function MarketingNavbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<DropdownType | null>(null);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const openMenu = (dropdown: DropdownType) => {
    if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
    setOpenDropdown(dropdown);
  };

  const closeMenu = () => {
    dropdownTimeoutRef.current = setTimeout(() => setOpenDropdown(null), 150);
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className="bg-white backdrop-blur-lg sticky top-0 z-50 w-full relative">
      {/* Animated border from center */}
      <div
        className="absolute bottom-0 left-1/2 h-px bg-marketing transition-all duration-500 ease-out z-0 pointer-events-none"
        style={{
          width: isScrolled ? "100%" : "0%",
          transform: "translateX(-50%)",
        }}
      />
      <div className="relative z-10 max-w-[1334px] mx-auto px-4 sm:px-6">
        <div className="relative flex items-center justify-between h-14 sm:h-16 lg:h-20">
          {/* Left: Logo */}
          <div className="shrink-0">
            <Link href="/" className="hover:opacity-90 transition-opacity">
              <PillarLogoWithName className="h-6 sm:h-7 lg:h-8" />
            </Link>
          </div>

          {/* Center: Nav Links (absolutely centered) */}
          <div className="hidden md:flex items-center gap-6 lg:gap-8 absolute left-1/2 -translate-x-1/2">
            {navLinks.map((link) =>
              link.dropdown ? (
                <div
                  key={link.name}
                  className="relative"
                  onMouseEnter={() => openMenu(link.dropdown)}
                  onMouseLeave={closeMenu}
                >
                  <button
                    className="inline-flex items-center gap-1 text-sm sm:text-[0.9375rem] font-medium text-[#1A1A1A] hover:text-[#FF6E00] transition-colors whitespace-nowrap"
                    onClick={() => setOpenDropdown((prev) => prev === link.dropdown ? null : link.dropdown)}
                  >
                    {link.name}
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${openDropdown === link.dropdown ? "rotate-180" : ""}`}
                    />
                  </button>

                  {/* Dropdown */}
                  <div
                    className={`absolute z-50 top-full left-1/2 -translate-x-1/2 pt-2 transition-all duration-200 ${
                      openDropdown === link.dropdown
                        ? "opacity-100 translate-y-0 pointer-events-auto"
                        : "opacity-0 -translate-y-1 pointer-events-none"
                    }`}
                  >
                    <div
                      className="w-[340px] rounded-xl border border-gray-200 shadow-lg shadow-black/[0.08] overflow-hidden p-1.5"
                      style={{ background: "#fff" }}
                    >
                      {dropdownItemsMap[link.dropdown].map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpenDropdown(null)}
                          className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-[#FFF7F0] transition-colors group"
                        >
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FFF1E6] text-[#FF6E00] group-hover:bg-[#FFE4CC] transition-colors">
                            <item.icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-[#1A1A1A] group-hover:text-[#FF6E00] transition-colors">
                              {item.name}
                            </div>
                            <div className="text-xs text-[#6B6B6B] mt-0.5 leading-snug">
                              {item.description}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <Link
                  key={link.name}
                  href={link.href}
                  className="text-sm sm:text-[0.9375rem] font-medium text-[#1A1A1A] hover:text-[#FF6E00] transition-colors whitespace-nowrap"
                >
                  {link.name}
                </Link>
              )
            )}
          </div>

          {/* Right: GitHub + Login + CTA (desktop) */}
          <div className="hidden md:flex items-center gap-4 lg:gap-5 shrink-0">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1A1A1A] hover:text-[#FF6E00] transition-colors"
              aria-label="GitHub"
            >
              <GitHubIcon className="h-5 w-5" />
            </a>
            <a
              href="/login"
              className="text-sm sm:text-[0.9375rem] font-medium text-[#1A1A1A] hover:text-[#FF6E00] transition-colors"
            >
              Log In
            </a>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center h-9 sm:h-10 lg:h-11 px-4 sm:px-5 lg:px-6 text-sm sm:text-[0.9375rem] font-medium rounded-lg bg-[#FF6E00] text-white hover:bg-[#E06200] transition-colors"
            >
              Get Started
            </Link>
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
              {navLinks.map((link) =>
                link.dropdown ? (
                  <div key={link.name} className="flex flex-col">
                    <span className="py-2 text-[#1A1A1A] font-medium text-xs uppercase tracking-wider text-[#6B6B6B]">
                      {link.name}
                    </span>
                    {dropdownItemsMap[link.dropdown].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="py-2 pl-3 text-[#1A1A1A] hover:text-[#FF6E00] transition-colors font-medium inline-flex items-center gap-2"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <item.icon className="h-4 w-4 text-[#FF6E00]" />
                        {item.name}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Link
                    key={link.name}
                    href={link.href}
                    className="py-2 text-[#1A1A1A] hover:text-[#FF6E00] transition-colors font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.name}
                  </Link>
                )
              )}
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 text-[#1A1A1A] hover:text-[#FF6E00] transition-colors font-medium inline-flex items-center gap-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                <GitHubIcon className="h-4 w-4" />
                GitHub
              </a>
              <a
                href="/login"
                className="py-2 text-[#1A1A1A] hover:text-[#FF6E00] transition-colors font-medium"
              >
                Log In
              </a>
              <div className="pt-2">
                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex items-center justify-center h-10 px-6 text-sm font-medium rounded-lg bg-[#FF6E00] text-white hover:bg-[#E06200] transition-colors w-full"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Gradient bottom border */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[1px] z-0 pointer-events-none"
        style={{
          background: "linear-gradient(90deg, rgba(212,212,212,0) 0%, #D4D4D4 30%, #D4D4D4 70%, rgba(212,212,212,0) 100%)",
        }}
      />
    </nav>
  );
}

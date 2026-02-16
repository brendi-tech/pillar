"use client";

import { ScoreGauge } from "@/components/AgentScore/ScoreGauge";
import { agentScoreAPI } from "@/lib/public/agent-score-api";
import Link from "next/link";
import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Static domain list — scores fetched dynamically via lookupByDomain
// ---------------------------------------------------------------------------

interface CompanyEntry {
  domain: string;
  label: string;
  tag: string;
}

const COMPANIES: CompanyEntry[] = [
  // Tech-forward startups / Series A-B
  { domain: "linear.app", label: "Linear", tag: "Series C" },
  { domain: "resend.com", label: "Resend", tag: "Series A" },
  { domain: "neon.tech", label: "Neon", tag: "Series B" },
  { domain: "clerk.com", label: "Clerk", tag: "Series C" },
  { domain: "cal.com", label: "Cal.com", tag: "Series A" },
  { domain: "loops.so", label: "Loops", tag: "Series A" },
  { domain: "dub.co", label: "Dub", tag: "Seed" },

  // Tech-forward established
  { domain: "vercel.com", label: "Vercel", tag: "Series D" },
  { domain: "shopify.com", label: "Shopify", tag: "Public" },
  { domain: "hubspot.com", label: "HubSpot", tag: "Public" },
  { domain: "twilio.com", label: "Twilio", tag: "Public" },
  { domain: "gusto.com", label: "Gusto", tag: "Late stage" },
  { domain: "zendesk.com", label: "Zendesk", tag: "Public" },

  // Traditional companies
  { domain: "acehardware.com", label: "Ace Hardware", tag: "Traditional" },
  { domain: "potterybarn.com", label: "Pottery Barn", tag: "Traditional" },
  { domain: "1800flowers.com", label: "1-800-Flowers", tag: "Traditional" },
  { domain: "papajohns.com", label: "Papa Johns", tag: "Traditional" },
  {
    domain: "dickssportinggoods.com",
    label: "Dick's Sporting",
    tag: "Traditional",
  },
  { domain: "jcrew.com", label: "J.Crew", tag: "Traditional" },
  { domain: "rei.com", label: "REI", tag: "Traditional" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ScoreEntry extends CompanyEntry {
  score: number | null;
}

export function CompanyShowcase() {
  const [entries, setEntries] = useState<ScoreEntry[]>(
    COMPANIES.map((c) => ({ ...c, score: null }))
  );
  const [loaded, setLoaded] = useState(false);

  // Fetch scores on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchScores() {
      const results = await Promise.allSettled(
        COMPANIES.map((c) => agentScoreAPI.lookupByDomain(c.domain))
      );

      if (cancelled) return;

      setEntries(
        COMPANIES.map((company, i) => {
          const result = results[i];
          const report = result.status === "fulfilled" ? result.value : null;
          return {
            ...company,
            score: report?.overall_score ?? null,
          };
        })
      );
      setLoaded(true);
    }

    fetchScores();
    return () => {
      cancelled = true;
    };
  }, []);

  // Only show companies that have a score
  const visibleEntries = loaded
    ? entries.filter((e) => e.score !== null)
    : entries;

  // Don't render the section if no scores loaded yet and we've finished fetching
  if (loaded && visibleEntries.length === 0) return null;

  // Each card is 180px + 16px gap = 196px effective width
  const cardEffectiveWidth = 196;
  const halfWidth = visibleEntries.length * cardEffectiveWidth;
  const duration = Math.max(visibleEntries.length * 3, 40);

  return (
    <section className="mt-16">
      {/* Section divider */}
      <div className="flex items-center gap-4 mb-8">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#E8E4DC] to-transparent" />
        <h2 className="text-lg font-semibold text-[#1A1A1A] shrink-0">
          How do you stack up?
        </h2>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#E8E4DC] to-transparent" />
      </div>

      {/* Marquee container */}
      <div
        className="group relative overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(to right, transparent, black 4%, black 96%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 4%, black 96%, transparent)",
        }}
      >
        <div
          className="flex w-max gap-4 group-hover:[animation-play-state:paused] marquee-track"
          style={
            {
              "--marquee-distance": `-${halfWidth}px`,
              "--marquee-duration": `${duration}s`,
            } as React.CSSProperties
          }
        >
          {/* Render list twice for seamless looping */}
          {[...visibleEntries, ...visibleEntries].map((entry, i) => (
            <Link
              key={`${entry.domain}-${i}`}
              href={`/tools/agent-score?domain=${entry.domain}`}
              className="flex-none w-[180px] bg-white border border-[#E8E4DC] rounded-xl p-4 flex flex-col items-center gap-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:border-[#FF6E00]/20 transition-all duration-200"
            >
              {/* Favicon + domain */}
              <div className="flex items-center gap-2 w-full min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://www.google.com/s2/favicons?domain=${entry.domain}&sz=32`}
                  alt=""
                  width={20}
                  height={20}
                  className="shrink-0 rounded-sm"
                />
                <span className="text-sm font-medium text-[#1A1A1A] truncate">
                  {entry.label}
                </span>
              </div>

              {/* Score gauge */}
              <ScoreGauge score={entry.score} size="sm" animated={false} />

              {/* Tag */}
              <span className="text-[11px] text-[#999] font-medium">
                {entry.tag}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

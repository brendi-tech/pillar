"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useInView } from "../marketing/hooks/useInView";
import { TechnicalShowcase } from "./TechnicalShowcase";

// Demo data imports (shared with Remotion, no Remotion dependency)
import { bankingDemo } from "../../remotion/videos/data/banking";
import { crmDemo } from "../../remotion/videos/data/crm";
import { analyticsDemo } from "../../remotion/videos/data/analytics";
import { pmDemo } from "../../remotion/videos/data/pm";
import { hrDemo } from "../../remotion/videos/data/hr";
import type { DemoConfig } from "../../remotion/videos/types";

// Timing constants
const TRANSITION_DELAY = 150; // Delay before starting next example

// Map demo IDs to their config data
const DEMO_CONFIGS: Record<string, DemoConfig> = {
  banking: bankingDemo,
  crm: crmDemo,
  analytics: analyticsDemo,
  pm: pmDemo,
  hr: hrDemo,
};

// Chat examples data with video files for each action
const chatExamples = [
  {
    id: "banking",
    label: "Banking",
    productName: "Online Banking",
    tabLabel: "Send money",
    videoFile: "/marketing/BankingDemo.mp4",
    technicalVideoFile: "/marketing/BankingDemo-technical.mp4",
    wireframeVideoFile: "/marketing/BankingWireframe.mp4",
    videoDuration: 18000, // 540 frames @ 30fps
    urlBar: "banking.example.com/payments",
    badgeColor: "#10B981",
    badgeText: "BK",
    color: "#10B981",
  },
  {
    id: "crm",
    label: "CRM",
    productName: "Salesforce",
    tabLabel: "Close deal",
    videoFile: "/marketing/CRMDemo.mp4",
    technicalVideoFile: "/marketing/CRMDemo-technical.mp4",
    wireframeVideoFile: "/marketing/CRMWireframe.mp4",
    videoDuration: 18000, // 544 frames @ 30fps
    urlBar: "acme.lightning.force.com/opportunities",
    badgeColor: "#00A1E0",
    badgeText: "SF",
    color: "#FF6E00",
  },
  {
    id: "analytics",
    label: "Analytics",
    productName: "Amplitude",
    tabLabel: "Add chart",
    videoFile: "/marketing/AnalyticsDemo.mp4",
    technicalVideoFile: "/marketing/AnalyticsDemo-technical.mp4",
    wireframeVideoFile: "/marketing/AnalyticsWireframe.mp4",
    videoDuration: 18000, // 540 frames @ 30fps
    urlBar: "analytics.amplitude.com/dashboard",
    badgeColor: "#1E40AF",
    badgeText: "AM",
    color: "#22C55E",
  },
  {
    id: "pm",
    label: "Project Management",
    productName: "Linear",
    tabLabel: "Create bug",
    videoFile: "/marketing/PMDemo.mp4",
    technicalVideoFile: "/marketing/PMDemo-technical.mp4",
    wireframeVideoFile: "/marketing/PMWireframe.mp4",
    videoDuration: 18000, // 540 frames @ 30fps
    urlBar: "linear.app/team/issues",
    badgeColor: "#5E6AD2",
    badgeText: "LN",
    color: "#3B82F6",
  },
  {
    id: "hr",
    label: "HR/People",
    productName: "Rippling",
    tabLabel: "Update bank",
    videoFile: "/marketing/HRDemo.mp4",
    technicalVideoFile: "/marketing/HRDemo-technical.mp4",
    wireframeVideoFile: "/marketing/HRWireframe.mp4",
    videoDuration: 16500, // 495 frames @ 30fps
    urlBar: "app.rippling.com/payroll",
    badgeColor: "#8B5CF6",
    badgeText: "RP",
    color: "#8B5CF6",
  },
];

/**
 * ChatShowcase - Video demonstrations of Pillar actions
 * Cycles through examples showing video demos for each product category
 * Designed to be used inside DemoSection
 *
 * Feature flag: Add ?v=technical to the URL to show the hybrid
 * React+video technical breakdown instead of the default screen recordings.
 */
export function ChatShowcase() {
  const { ref, isInView } = useInView({ threshold: 0.5, rootMargin: "0px" });
  const searchParams = useSearchParams();
  const isTechnical = searchParams.get("v") === "technical";

  const [currentExampleIndex, setCurrentExampleIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const sessionIdRef = useRef(0);

  const currentExample = chatExamples[currentExampleIndex];

  // Start a new example sequence
  const startExample = useCallback((exampleIndex: number) => {
    sessionIdRef.current += 1;
    const currentSession = sessionIdRef.current;

    setCurrentExampleIndex(exampleIndex);

    const example = chatExamples[exampleIndex];

    // Wait for video duration then move to next
    setTimeout(() => {
      if (sessionIdRef.current !== currentSession) return;
      const nextIndex = (exampleIndex + 1) % chatExamples.length;
      setTimeout(() => {
        if (sessionIdRef.current !== currentSession) return;
        startExample(nextIndex);
      }, TRANSITION_DELAY);
    }, example.videoDuration);
  }, []);

  // Start auto-cycling when in view
  useEffect(() => {
    if (isInView && !hasStarted) {
      setHasStarted(true);
      startExample(0);
    }
  }, [isInView, hasStarted, startExample]);

  // Handle tab click
  const handleTabClick = useCallback((index: number) => {
    setIsPaused(false);
    startExample(index);
  }, [startExample]);

  // Handle video click to toggle play/pause
  const handleVideoClick = useCallback(() => {
    const video = videoRefs.current[currentExampleIndex];
    if (!video) return;

    if (isPaused) {
      video.play().catch(() => {});
      setIsPaused(false);
    } else {
      video.pause();
      setIsPaused(true);
    }
  }, [currentExampleIndex, isPaused]);

  // Handle toggle for technical mode (TechnicalShowcase manages its own video ref)
  const handleTechnicalToggle = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  // Play/pause videos based on active index and pause state (default mode only)
  useEffect(() => {
    if (!hasStarted || isTechnical) return;

    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      
      if (index === currentExampleIndex && !isPaused) {
        video.currentTime = 0;
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, [currentExampleIndex, isPaused, hasStarted, isTechnical]);

  return (
    <div ref={ref}>
      {/* Action Tabs */}
      <div className="pb-8 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="flex justify-center min-w-max px-4 md:px-6">
          <div className="inline-flex bg-[#F3EFE8] divide-x divide-white">
            {chatExamples.map((example, index) => (
              <button
                key={example.id}
                onClick={() => handleTabClick(index)}
                className={`px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-mono tracking-wider transition-colors whitespace-nowrap ${
                  index === currentExampleIndex
                    ? "text-[#FF6E00] bg-[#FF6E00]/10"
                    : "text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-[#EBE7E0]"
                }`}
              >
                {example.tabLabel.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Demo Content */}
      <div className="px-4 md:px-6 lg:px-8 pb-8 md:pb-16">
        <div className="max-w-7xl mx-auto">
          {isTechnical ? (
            /* ── Technical mode: hybrid React + video layout ── */
            <TechnicalShowcase
              key={currentExample.id}
              prompt={DEMO_CONFIGS[currentExample.id]?.prompt ?? ""}
              steps={DEMO_CONFIGS[currentExample.id]?.steps ?? []}
              wireframeVideoSrc={currentExample.wireframeVideoFile}
              isPlaying={hasStarted && !isPaused}
              onTogglePlay={handleTechnicalToggle}
            />
          ) : (
            /* ── Default mode: full-screen video with browser chrome ── */
            <div className="rounded-lg shadow-lg overflow-hidden bg-[#1A1A1A]">
              {/* Browser Chrome Header */}
              <div className="bg-[#E8E8E8] px-4 py-2.5 flex items-center gap-3">
                {/* Traffic lights */}
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                  <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                  <div className="w-3 h-3 rounded-full bg-[#28CA41]" />
                </div>
                {/* URL Bar */}
                <div className="flex-1 bg-white rounded-md px-3 py-1 flex items-center gap-2 max-w-md mx-auto">
                  <svg className="w-3.5 h-3.5 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="text-xs text-[#6B7280] truncate">
                    {currentExample.urlBar}
                  </span>
                </div>
                {/* Product badge */}
                <div className="flex items-center gap-1.5">
                  <div 
                    className="w-5 h-5 rounded flex items-center justify-center"
                    style={{ backgroundColor: currentExample.badgeColor }}
                  >
                    <span className="text-white text-[10px] font-bold">{currentExample.badgeText}</span>
                  </div>
                  <span className="text-xs font-medium text-[#374151] hidden sm:inline">{currentExample.productName}</span>
                </div>
              </div>
              {/* Video Content */}
              <div 
                className="aspect-video relative cursor-pointer group"
                style={{ backgroundColor: "#1A1A1A" }}
                onClick={handleVideoClick}
              >
                {chatExamples.map((example, index) => (
                  <video
                    key={example.id}
                    ref={(el) => { videoRefs.current[index] = el; }}
                    loop
                    muted
                    playsInline
                    preload={index === 0 ? "auto" : "metadata"}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                      index === currentExampleIndex ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}
                  >
                    <source src={example.videoFile} type="video/mp4" />
                  </video>
                ))}
                {/* Play button overlay when paused */}
                {isPaused && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity">
                    <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                      <svg className="w-8 h-8 text-[#1A1A1A] ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Caption */}
          <p className="text-center text-sm text-[#6B6B6B] mt-4 px-4">
            From CRM to banking, Pillar turns plain-language requests into
            completed actions.
          </p>
        </div>
      </div>
    </div>
  );
}

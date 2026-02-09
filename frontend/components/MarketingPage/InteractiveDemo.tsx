"use client";

import { Check, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useInView } from "../marketing/hooks/useInView";

const CARD_INTERVAL = 10000; // 10 seconds per card
const CRM_VIDEO_DURATION = 18000; // 18 seconds - matches CRMDemo video length
const TICK_INTERVAL = 50; // Smooth progress updates
const STEP_INTERVAL = 1250; // 500ms animation + 750ms delay

const verticals = [
  {
    id: "crm",
    label: "CRM",
    userRequest: "Close the Walmart deal as won in Salesforce and notify implementation",
    color: "#FF6E00",
    steps: [
      { text: "Searching for Walmart deal...", status: "complete" },
      { text: "Opening opportunity record", status: "complete" },
      { text: "Pre-filling stage as Closed Won", status: "active" },
      { text: "Opening implementation handoff form", status: "pending" },
      { text: "Pre-filling deal context for handoff", status: "pending" },
    ],
  },
  {
    id: "analytics",
    label: "ANALYTICS",
    userRequest: "Add a weekly signups chart to my Amplitude dashboard",
    color: "#22C55E",
    steps: [
      { text: "Navigating to Charts...", status: "complete" },
      { text: "Creating new chart", status: "complete" },
      { text: "Selecting Signups event", status: "active" },
      { text: "Setting interval to weekly", status: "pending" },
      { text: "Adding to your dashboard", status: "pending" },
    ],
  },
  {
    id: "pm",
    label: "PROJECT MANAGEMENT",
    shortLabel: "PROJECT",
    userRequest: "Create a P1 bug in Linear for the checkout crash and add it to this sprint",
    color: "#3B82F6",
    steps: [
      { text: "Opening new issue form...", status: "complete" },
      { text: "Setting type to Bug", status: "complete" },
      { text: "Setting priority to P1", status: "active" },
      { text: "Pre-filling title with 'Checkout crash'", status: "pending" },
      { text: "Adding to current cycle", status: "pending" },
    ],
  },
  {
    id: "hr",
    label: "HR/PEOPLE",
    userRequest: "How do I change my direct deposit in Rippling?",
    color: "#8B5CF6",
    steps: [
      { text: "Navigating to Payroll settings...", status: "complete" },
      { text: "Opening Direct Deposit section", status: "complete" },
      { text: "Opening edit form for bank account", status: "active" },
      { text: "Ready for your new bank details", status: "pending" },
    ],
  },
  {
    id: "devtools",
    label: "DEV TOOLS",
    userRequest: "How do I set up a webhook in Stripe?",
    color: "#1A1A1A",
    steps: [
      { text: "Navigating to Developers → Webhooks...", status: "complete" },
      { text: "Opening 'Add endpoint' form", status: "complete" },
      { text: "Ready for your endpoint URL", status: "active" },
      { text: "Will show signing secret after creation", status: "pending" },
    ],
  },
];

/**
 * InteractiveDemo - Tabs and interactive card with auto-rotating examples
 * Only runs animations when visible in the viewport
 */
export function InteractiveDemo() {
  const { ref, isInView } = useInView({ threshold: 0.8 }); // Start when 80% visible
  const [activeVertical, setActiveVertical] = useState(0);
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoReady, setVideoReady] = useState(false);

  const progressRef = useRef(0);
  const cardIndexRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    cardIndexRef.current = activeVertical;
  }, [activeVertical]);

  const currentVertical = verticals[activeVertical];

  const advanceCard = useCallback(() => {
    setVideoReady(false); // Fade out before switching
    const nextIndex = (cardIndexRef.current + 1) % verticals.length;
    setActiveVertical(nextIndex);
    setVisibleSteps(0);
    progressRef.current = 0;
    setProgress(0);
    // Reset video state when advancing
    setVideoDuration(0);
    setVideoFailed(false);
  }, []);

  // Check if we're showing video
  const showingVideo = !videoFailed && videoDuration > 0;

  // Get the appropriate interval for the current tab (use video duration when video is loaded)
  const currentInterval = showingVideo ? CRM_VIDEO_DURATION : CARD_INTERVAL;

  // Card timer - only run when in view, not paused, and not showing video
  // (video progress and advance is handled separately)
  useEffect(() => {
    if (isPaused || !isInView || showingVideo) return;

    const interval = setInterval(() => {
      const increment = (100 / currentInterval) * TICK_INTERVAL;
      progressRef.current += increment;

      if (progressRef.current >= 100) {
        advanceCard();
      } else {
        setProgress(progressRef.current);
      }
    }, TICK_INTERVAL);

    return () => clearInterval(interval);
  }, [isPaused, isInView, advanceCard, showingVideo, currentInterval]);

  // Step timer - only run when in view and not paused
  useEffect(() => {
    if (isPaused || !isInView) return;

    const totalSteps = verticals[activeVertical]?.steps?.length ?? 0;
    if (visibleSteps >= totalSteps) return;

    const stepTimer = setTimeout(() => {
      setVisibleSteps((prev) => Math.min(prev + 1, totalSteps));
    }, STEP_INTERVAL);

    return () => clearTimeout(stepTimer);
  }, [isPaused, isInView, visibleSteps, activeVertical]);

  const handleVerticalSelect = useCallback((index: number) => {
    // Do nothing if clicking the already active tab
    if (index === cardIndexRef.current) return;
    
    setVideoReady(false); // Fade out before switching
    setActiveVertical(index);
    setVisibleSteps(0);
    progressRef.current = 0;
    setProgress(0);
    setVideoFailed(false); // Reset video error for new tab
    setVideoDuration(0); // Reset so video reloads fresh
  }, []);

  // Handle pause/play for video
  useEffect(() => {
    if (!videoRef.current) return;
    if (isPaused) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  }, [isPaused]);

  // Auto-play video when tab becomes active
  useEffect(() => {
    if (videoRef.current && !isPaused) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }
  }, [activeVertical, isPaused]);

  // Smooth video progress updates using requestAnimationFrame
  // Also detects when video loops to advance to next card
  useEffect(() => {
    if (!showingVideo || isPaused) return;

    let animationId: number;
    let lastProgress = 0;

    const updateProgress = () => {
      if (videoRef.current && videoRef.current.duration > 0) {
        const videoProgress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
        
        // Detect video loop: progress was high (>95%) and now low (<5%)
        if (lastProgress > 95 && videoProgress < 5) {
          advanceCard();
          return; // Stop this animation loop, new one will start for next card
        }
        
        lastProgress = videoProgress;
        setProgress(videoProgress);
        progressRef.current = videoProgress;
      }
      animationId = requestAnimationFrame(updateProgress);
    };

    animationId = requestAnimationFrame(updateProgress);

    return () => cancelAnimationFrame(animationId);
  }, [showingVideo, isPaused, advanceCard]);

  return (
    <div ref={ref}>
      {/* Vertical Tabs */}
      <div className="pb-8 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="flex justify-center min-w-max px-4 md:px-6">
          <div className="inline-flex bg-[#F3EFE8] divide-x divide-white">
            {verticals.map((vertical, index) => (
              <button
                key={vertical.id}
                onClick={() => handleVerticalSelect(index)}
                className={`px-2 sm:px-4 py-1 text-[10px] sm:text-xs font-mono tracking-wider transition-colors whitespace-nowrap ${
                  index === activeVertical
                    ? "text-white bg-[#FF6E00]"
                    : "text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-[#EBE7E0]"
                }`}
              >
                {vertical.shortLabel ? (
                  <>
                    <span className="sm:hidden">{vertical.shortLabel}</span>
                    <span className="hidden sm:inline">{vertical.label}</span>
                  </>
                ) : (
                  vertical.label
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Demo Card */}
      <div className="px-4 md:px-6 lg:px-8 pb-8 md:pb-16">
        <div className="max-w-4xl mx-auto relative">
          {/* Code background decoration - hidden on mobile */}
          <div className="hidden md:block absolute inset-0 -mx-8 md:-mx-16 overflow-hidden opacity-[0.07] pointer-events-none font-mono text-xs text-[#1A1A1A] leading-relaxed select-none">
            <div className="absolute bottom-32 left-0 whitespace-pre">
              {`JFrame frame = new Pillar Frame ("*PILLAR");
Container panel = frame.getContentPanel();
panel.add(hey);
frame.pack();
frame.show();`}
            </div>
            <div className="absolute bottom-16 right-0 whitespace-pre text-right">
              {`// USE THIS TO MAKE SURE IT'S WORKING
JFrame frame = new Pillar Frame ("*PILLAR");
Container panel = frame.getContentPanel();
panel.add(hey);`}
            </div>
            <div className="absolute bottom-4 left-1/4 whitespace-pre">
              {`JButton hello = new Button ("it's working!")
// USE THIS TO MAKE SURE IT'S WORKING`}
            </div>
          </div>

          {/* Main card */}
          <div className="relative bg-white border border-[#E5E0D8] rounded-lg shadow-lg overflow-hidden">
            {!videoFailed ? (
              /* Video - replaces entire card content */
              <div className="relative aspect-[16/9] bg-[#F9F7F2]">
                <video
                  key={`video-${activeVertical}`}
                  ref={videoRef}
                  autoPlay
                  loop
                  muted
                  playsInline
                  onError={() => setVideoFailed(true)}
                  onCanPlay={() => setVideoReady(true)}
                  onLoadedMetadata={(e) => {
                    const video = e.currentTarget;
                    setVideoDuration(video.duration);
                    // Ensure video plays when loaded (handles tab switching)
                    if (!isPaused) {
                      video.play();
                    }
                  }}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                    videoReady ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {/* TODO: Add different videos for each vertical */}
                  <source src="/marketing/CRMDemo.mp4" type="video/mp4" />
                </video>
              </div>
            ) : (
              /* Standard card content for video fallback */
              <>
                {/* User request - plain on mobile, bubble on larger screens */}
                <div className="p-4 md:p-6 border-b border-[#E5E0D8] flex items-center justify-center md:justify-end h-[72px] md:h-auto">
                  <div className="md:bg-[#F3EFE8] md:rounded-2xl md:rounded-br-sm px-4 md:px-5 py-2 md:py-3">
                    <p className="text-[#1A1A1A] font-medium text-sm md:text-base md:whitespace-nowrap text-center md:text-left">
                      &ldquo;{currentVertical.userRequest}&rdquo;
                    </p>
                  </div>
                </div>

                {/* Steps - fixed height to prevent layout shift */}
                <div className="p-6 space-y-3 min-h-[240px]">
                  {currentVertical.steps.map((step, index) => {
                    const isVisible = index < visibleSteps;
                    const isComplete = index < visibleSteps - 1;
                    const isActive = index === visibleSteps - 1;

                    return (
                      <div
                        key={index}
                        className={`flex items-center gap-3 transition-all duration-500 ${
                          isVisible
                            ? "opacity-100 translate-y-0"
                            : "opacity-0 translate-y-2"
                        }`}
                      >
                        {/* Status indicator */}
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                            isComplete
                              ? "bg-[#22C55E] text-white"
                              : isActive
                                ? "bg-[#FF6E00]/10 border-2 border-[#FF6E00]"
                                : "bg-[#E5E0D8]"
                          }`}
                        >
                          {isComplete && <Check className="w-3 h-3" />}
                          {isActive && (
                            <div className="w-2 h-2 bg-[#FF6E00] rounded-full animate-pulse" />
                          )}
                        </div>

                        {/* Step text */}
                        <span
                          className={`text-sm ${
                            isActive
                              ? "text-[#FF6E00] font-medium"
                              : isComplete
                                ? "text-[#6B6B6B]"
                                : "text-[#A0A0A0]"
                          }`}
                        >
                          {step.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Caption */}
          <p className="text-center text-sm text-[#6B6B6B] mt-4 px-4">
            From CRM to dev tools, Pillar turns plain-language requests into
            completed actions.
          </p>

          {/* Pause/Play control */}
          <div className="flex justify-center mt-2">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-[#C0C0C0] hover:text-[#6B6B6B] transition-colors opacity-60 hover:opacity-100"
            >
              {isPaused ? (
                <>
                  <Play className="w-3 h-3" /> Play
                </>
              ) : (
                <>
                  <Pause className="w-3 h-3" /> Pause
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

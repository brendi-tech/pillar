"use client";

/**
 * TechnicalShowcase — Hybrid React + video component for the
 * technical demo view (activated via ?v=technical).
 *
 * Layout:
 * - Top: TechnicalPromptHeader (React, static)
 * - Left column: TechnicalStepTimeline (React, driven by video time)
 * - Right column: Wireframe-only video (square, Remotion-rendered MP4)
 *
 * The step timeline is synchronized to the wireframe video via
 * requestAnimationFrame polling of video.currentTime.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { DemoStep } from "../../remotion/videos/types";
import { VIDEO_FPS } from "../../remotion/videos/constants";
import {
  getActiveStepIndex,
  getStepActivationFrames,
} from "../../remotion/videos/timing";
import { TechnicalPromptHeader } from "./TechnicalPromptHeader";
import { TechnicalStepTimeline } from "./TechnicalStepTimeline";

interface TechnicalShowcaseProps {
  prompt: string;
  steps: DemoStep[];
  wireframeVideoSrc: string;
  /** Whether the video should be playing */
  isPlaying: boolean;
  /** Called when the user clicks the video to toggle play/pause */
  onTogglePlay: () => void;
  /** Ref callback to expose the video element to the parent */
  videoRefCallback?: (el: HTMLVideoElement | null) => void;
}

export function TechnicalShowcase({
  prompt,
  steps,
  wireframeVideoSrc,
  isPlaying,
  onTogglePlay,
  videoRefCallback,
}: TechnicalShowcaseProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(-1);

  // Combine internal ref with parent ref callback
  const setVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      videoRefCallback?.(el);
    },
    [videoRefCallback]
  );

  // Sync step timeline with video playback via rAF
  useEffect(() => {
    const tick = () => {
      const video = videoRef.current;
      if (video) {
        const frame = Math.floor(video.currentTime * VIDEO_FPS);
        const idx = getActiveStepIndex(frame, steps);
        setActiveStepIndex((prev) => (prev !== idx ? idx : prev));
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [steps]);

  // Play/pause the video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => {
        // Autoplay may be blocked
      });
    } else {
      video.pause();
    }
  }, [isPlaying]);

  // Seek the video to a specific step when the user clicks it
  const handleStepClick = useCallback(
    (stepIndex: number) => {
      const video = videoRef.current;
      if (!video) return;

      const activationFrames = getStepActivationFrames(steps);
      const targetFrame = activationFrames[stepIndex] ?? 0;
      video.currentTime = targetFrame / VIDEO_FPS;

      // If paused, start playing
      if (!isPlaying) {
        onTogglePlay();
      }
    },
    [steps, isPlaying, onTogglePlay]
  );

  return (
    <div>
      {/* Prompt Header */}
      <div className="mb-4 md:mb-6">
        <TechnicalPromptHeader prompt={prompt} />
      </div>

      {/* Two-column layout */}
      <div className="flex gap-4 md:gap-6 min-h-[400px]">
        {/* Left column: Step Timeline */}
        <div className="w-[260px] md:w-[300px] flex-shrink-0 overflow-y-auto">
          <TechnicalStepTimeline
            steps={steps}
            activeStepIndex={activeStepIndex}
            onStepClick={handleStepClick}
          />
        </div>

        {/* Right column: Wireframe Video */}
        <div
          className="flex-1 min-w-0 relative cursor-pointer group"
          onClick={onTogglePlay}
        >
          <div className="aspect-square w-full rounded-lg overflow-hidden">
            <video
              ref={setVideoRef}
              loop
              muted
              playsInline
              preload="auto"
              className="w-full h-full object-cover"
            >
              <source src={wireframeVideoSrc} type="video/mp4" />
            </video>
          </div>

          {/* Play button overlay when paused */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded-lg transition-opacity">
              <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                <svg
                  className="w-7 h-7 text-[#1A1A1A] ml-0.5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

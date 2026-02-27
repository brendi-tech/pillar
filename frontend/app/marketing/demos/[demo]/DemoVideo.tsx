"use client";

import { useEffect, useRef } from "react";

interface DemoVideoProps {
  mp4: string;
  poster?: string;
}

export function DemoVideo({ mp4, poster }: DemoVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.play().catch(() => {
      // Autoplay blocked — user can click play via controls
    });
  }, []);

  return (
    <video
      ref={videoRef}
      loop
      muted
      controls
      playsInline
      preload="auto"
      poster={poster}
      className="w-full h-auto"
    >
      <source src={mp4} type="video/mp4" />
    </video>
  );
}

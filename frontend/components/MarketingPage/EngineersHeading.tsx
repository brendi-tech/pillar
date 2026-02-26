"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const TAGS = [
  { label: "TRUST", className: "-top-2.5 left-[100px]" },
  { label: "CLEAR VISION", className: "-bottom-4 left-[50px]" },
  { label: "CODE", className: "top-1 left-[402px]" },
  { label: "IMPLEMENTATION", className: "-top-2 left-[758px]" },
];

export function EngineersHeading() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "-30% 0px -30% 0px",
        threshold: 0,
      }
    );

    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <h2 className="font-editorial relative text-regular text-3xl md:text-5xl lg:text-[4.75rem] lg:leading-[62px] text-center text-[#020202]">
        Built for Engineers who ship
      </h2>
      {TAGS.map((tag, index) => (
        <p
          key={tag.label}
          className={cn(
            "hidden lg:block font-mono text-[#FF6E00] text-xs bg-[#332429] w-fit px-2.5 py-1 absolute whitespace-nowrap",
            "transition-all duration-500 ease-out",
            tag.className
          )}
          style={{
            transform: isVisible ? "scale(1)" : "scale(0)",
            opacity: isVisible ? 1 : 0,
            transitionDelay: isVisible ? `${index * 200}ms` : "0ms",
          }}
        >
          {tag.label}
        </p>
      ))}
    </div>
  );
}

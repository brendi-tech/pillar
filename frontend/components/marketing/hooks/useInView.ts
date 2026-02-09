"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useInView - Tiny IntersectionObserver hook for scroll-triggered animations
 *
 * Returns a ref to attach to the element and a boolean indicating if it's in view.
 * Once triggered, stays true (one-time reveal).
 */
export function useInView(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        }
      },
      { threshold: 0.15, rootMargin: "-80px", ...options }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [options]);

  return { ref, isInView };
}

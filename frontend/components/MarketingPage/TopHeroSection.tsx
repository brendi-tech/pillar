"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

interface TopHeroSectionProps {
  onOpenWaitlist?: (entryId?: string) => void;
}

type FormStatus = "idle" | "submitting" | "error";

const getBackendUrl = () => {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "trypillar.com" || hostname.endsWith(".trypillar.com")) {
      return "https://help-api.trypillar.com";
    }
  }
  return process.env.NEXT_PUBLIC_PILLAR_API_URL || "http://localhost:8003";
};

/**
 * TopHeroSection - Main hero with "The Product Copilot" heading
 * and inline waitlist email capture
 */
export function TopHeroSection({ onOpenWaitlist }: TopHeroSectionProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    try {
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/public/waitlist/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("idle");
        setEmail("");
        onOpenWaitlist?.(data.id);
      } else {
        setErrorMessage(
          data.detail || "Something went wrong. Please try again."
        );
        setStatus("error");
      }
    } catch {
      setErrorMessage(
        "Network error. Please check your connection and try again."
      );
      setStatus("error");
    }
  };

  return (
    <section className="group max-w-marketingSection mx-auto border-x border-marketing bg-white relative h-[500px] md:h-[688px] overflow-hidden">
      <Image
        src="/marketing/pillar-sky-v2.webp"
        alt="Pillar Sky Background"
        fill
        priority
        sizes="100vw"
        className="object-cover object-[15%_center] md:object-center z-0 transition-all duration-200 ease-out group-hover:scale-[1.025]"
        quality={80}
      />
      {/* Hero Header */}
      <div className="relative z-10 flex flex-col h-full">
        <div className="pt-8 md:pt-[180px] pb-8 md:pb-10 px-4 md:px-6 lg:px-8">
          <h1 className="font-editorial text-3xl md:text-5xl lg:text-[5.25rem] text-center text-white tracking-tight">
            The Product Copilot
          </h1>
          <p className="text-center text-base sm:text-lg md:text-[1.375rem] text-white mt-2 max-w-3xl mx-auto px-4 md:px-0">
            Pillar is the{" "}
            <a
              href="https://github.com/pillarhq/pillar"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-white/40 underline-offset-2 hover:decoration-white/80 transition-all duration-200"
            >
              Open Source
            </a>{" "}
            SDK for building AI agents into your product.
            <br className="hidden md:inline" />{" "}
            It takes action, and gets work done for your users.
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 pb-8 md:pb-12 px-4">
          <form
            onSubmit={handleEmailSubmit}
            className="flex flex-col sm:flex-row items-stretch sm:items-center rounded-2xl sm:rounded-full bg-black/30 backdrop-blur-md border border-white/20 p-1.5 w-full max-w-md"
          >
            <input
              type="email"
              placeholder="Enter your Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={status === "submitting"}
              className="flex-1 bg-transparent text-white placeholder:text-white/70 border-none outline-none px-5 py-2.5 text-base rounded-xl sm:rounded-l-full sm:rounded-r-none"
            />
            <button
              type="submit"
              disabled={status === "submitting"}
              className="group/btn relative inline-flex items-center justify-center rounded-full bg-[#FF6E00] hover:bg-[#E06200] text-white pl-6 pr-10 py-2.5 text-base font-medium transition-colors cursor-pointer disabled:opacity-70 whitespace-nowrap"
            >
              {status === "submitting" ? "Joining..." : "Join the Waitlist"}
              <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all duration-200" />
            </button>
          </form>
          {status === "error" && (
            <p className="text-sm text-red-200 bg-red-900/40 px-4 py-1.5 rounded-full">
              {errorMessage}
            </p>
          )}
        </div>
      </div>
      {/* <GridBackground
        className="w-full h-full absolute top-0 left-0 z-0"
        gradients={[
          {
            x: "50%",
            y: "10%",
            radius: "50%", // Use pixels for circles
            color: "white",
          },
          {
            x: "0%",
            y: "80%",
            radius: "20%",
            color: "white",
          },
          {
            x: "50%",
            y: "80%",
            radius: "50%",
            color: "white",
          },
          {
            x: "100%",
            y: "100%",
            radius: "40%",
            color: "white",
          },
        ]}
      /> */}
    </section>
  );
}

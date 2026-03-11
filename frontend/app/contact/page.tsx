 "use client";

import { Badge } from "@/components/ui/badge";
import { ContactUsForm } from "@/components/ContactUsForm";
import {
  ArrowUpRight,
  Clock3,
  FolderKanban,
  LifeBuoy,
  Mail,
  MonitorCog,
  Sparkles,
} from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo } from "react";

const SIGNALS = [
  {
    label: "Founder Inbox",
    value: "founders@trypillar.com",
    icon: Mail,
  },
  {
    label: "Typical Reply",
    value: "Within 1 business day",
    icon: Clock3,
  },
  {
    label: "Best For",
    value: "Demos, rollout plans, embedded AI questions",
    icon: MonitorCog,
  },
];

const REQUEST_LANES = [
  {
    title: "Demo",
    value: "Walk through how Pillar would fit your product surface.",
  },
  {
    title: "Implementation",
    value: "Talk SDK rollout, permissions, and action design.",
  },
  {
    title: "Pricing",
    value: "Get clear guidance on packaging and launch scope.",
  },
];

function ContactPageContent() {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-[0.5]">
        <div className="absolute left-[-8%] top-12 h-72 w-72 rounded-full bg-[#FF6E00]/12 blur-3xl" />
        <div className="absolute right-[-4%] top-8 h-80 w-80 rounded-full bg-[#1A1A1A]/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D7D0C6] to-transparent" />
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-70"
        style={{
          background:
            "radial-gradient(circle at 14% 18%, rgba(255,110,0,0.2), transparent 32%), radial-gradient(circle at 86% 8%, rgba(26,26,26,0.08), transparent 28%), linear-gradient(180deg, rgba(255,255,255,0.55), rgba(243,239,232,0))",
        }}
      />

      <section className="relative px-6 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
            <div className="flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-[#D8D2C8] bg-white/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.28em] text-[#8A5B37] backdrop-blur-sm"
                  >
                    Contact Pillar
                  </Badge>
                  <Badge className="bg-[#1A1A1A] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white">
                    Founder-routed
                  </Badge>
                </div>
                <h1 className="mt-6 max-w-xl text-[38px] font-semibold leading-[1.02] tracking-[-0.03em] text-[#1A1A1A] sm:text-[56px]">
                  Bring your product questions straight to us.
                </h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-[#5F5A55] sm:text-lg">
                  Considering Pillar for your app? Send a quick note and we can
                  help with the demo, rollout, or packaging decision.
                </p>
              </div>

              <div className="mt-10 space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  {SIGNALS.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-[24px] border border-[#DDD6CB] bg-white/85 p-4 shadow-[0_10px_35px_rgba(26,26,26,0.06)] backdrop-blur-sm"
                    >
                      <div className="flex items-center gap-2 text-[#9A6A45]">
                        <item.icon className="h-4 w-4" />
                        <span className="text-[11px] font-medium uppercase tracking-[0.22em]">
                          {item.label}
                        </span>
                      </div>
                      <p className="mt-4 text-sm font-medium leading-6 text-[#1A1A1A]">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="rounded-[28px] border border-[#D9D4CB] bg-[#161616] p-5 text-[#F7F3EC] shadow-[0_18px_60px_rgba(26,26,26,0.16)] sm:p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div
                      className="flex items-center gap-3 text-[#FFB37A]"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span className="text-sm font-medium uppercase tracking-[0.22em]">
                        Most Common Requests
                      </span>
                    </div>
                    <div className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[#A7A29A] sm:block">
                      Compact by design
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {REQUEST_LANES.map((item) => (
                      <div
                        key={item.title}
                        className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                      >
                        <p className="text-[11px] uppercase tracking-[0.2em] text-[#A7A29A]">
                          {item.title}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[#F7F3EC]">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <Mail className="mt-0.5 h-4 w-4 text-[#FFB37A]" />
                      <p className="text-sm leading-6 text-[#D8D1C7]">
                        Direct:{" "}
                        <a
                          href="mailto:founders@trypillar.com"
                          className="font-medium text-white underline decoration-white/30 underline-offset-4 transition hover:decoration-white"
                        >
                          founders@trypillar.com
                        </a>
                      </p>
                    </div>
                    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <LifeBuoy className="mt-0.5 h-4 w-4 text-[#FFB37A]" />
                      <p className="text-sm leading-6 text-[#D8D1C7]">
                        Support:{" "}
                        <a
                          href="mailto:support@trypillar.com"
                          className="font-medium text-white underline decoration-white/30 underline-offset-4 transition hover:decoration-white"
                        >
                          support@trypillar.com
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="pointer-events-none absolute -left-5 top-8 hidden h-24 w-24 rounded-full border border-[#E2D8CB] bg-white/60 blur-3xl lg:block" />
              <div className="pointer-events-none absolute -right-4 bottom-10 hidden h-32 w-32 rounded-full bg-[#FF6E00]/10 blur-3xl lg:block" />
              <ContactUsForm />

              <div className="mt-5 flex items-center gap-2 text-sm text-[#6B655E]">
                <ArrowUpRight className="h-4 w-4 text-[#FF6E00]" />
                <span>
                  Looking for docs first? Browse{" "}
                  <a
                    href="/docs"
                    className="font-medium text-[#1A1A1A] underline decoration-[#FF6E00]/40 underline-offset-4 transition hover:decoration-[#FF6E00]"
                  >
                    product documentation
                  </a>
                  .
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#DDD6CB] bg-white/80 p-4 shadow-[0_10px_35px_rgba(26,26,26,0.05)]">
                  <div className="flex items-center gap-2 text-[#9A6A45]">
                    <FolderKanban className="h-4 w-4" />
                    <span className="text-[11px] font-medium uppercase tracking-[0.22em]">
                      Helpful context
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#1A1A1A]">
                    Product URL, rough user count, and what you want the
                    assistant to actually do.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#DDD6CB] bg-white/80 p-4 shadow-[0_10px_35px_rgba(26,26,26,0.05)]">
                  <div className="flex items-center gap-2 text-[#9A6A45]">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-[11px] font-medium uppercase tracking-[0.22em]">
                      Good starting point
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#1A1A1A]">
                    A short message is enough. We can sort the details together
                    once we reply.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function ContactPage() {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
          },
        },
      }),
    []
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ContactPageContent />
    </QueryClientProvider>
  );
}

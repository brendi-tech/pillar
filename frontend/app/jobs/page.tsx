"use client";

import { ContactUsForm } from "@/components/ContactUsForm";
import { ArrowUpRight, GitBranch, MessageSquare, Star } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo } from "react";

function JobsPageContent() {
  return (
    <div>
      <section className="px-6 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-14 lg:items-start">
            <div className="max-w-sm pt-4">
              <h1 className="text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] text-[#1A1A1A] sm:text-[44px]">
                Jobs.
              </h1>
              <div className="mt-8 space-y-5 text-[15px] leading-7 text-[#5F5A55]">
                <p>
                  We&apos;re a small team and not actively hiring right now.
                </p>
                <p>
                  That said, we pay attention to people who build things. If
                  you&apos;ve built something with Pillar, posted about it, or
                  contributed to the repo — we notice.
                </p>
                <p>
                  The best way to get on our radar:
                </p>
              </div>

              <div className="mt-6 space-y-4">
                <a
                  href="https://github.com/pillarhq/pillar"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 group"
                >
                  <Star className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6E00]" />
                  <span className="text-sm leading-6 text-[#1A1A1A] group-hover:text-[#6B655E] transition-colors">
                    Star the repo, open a PR, or file an issue
                  </span>
                </a>
                <a
                  href="/docs"
                  className="flex items-start gap-3 group"
                >
                  <GitBranch className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6E00]" />
                  <span className="text-sm leading-6 text-[#1A1A1A] group-hover:text-[#6B655E] transition-colors">
                    Build something with the SDK — an integration, a
                    demo, an agent, anything
                  </span>
                </a>
                <div className="flex items-start gap-3">
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6E00]" />
                  <span className="text-sm leading-6 text-[#1A1A1A]">
                    Post about it — Reddit, Twitter, a blog, wherever
                  </span>
                </div>
              </div>

              <p className="mt-8 text-sm leading-6 text-[#6B655E]">
                Built something? Send it our way using the form.
                Include a link to your project and we&apos;ll take a look.
              </p>
            </div>

            <div>
              <ContactUsForm />

              <div className="mt-5 flex items-center gap-2 text-sm text-[#6B655E]">
                <ArrowUpRight className="h-4 w-4 text-[#FF6E00]" />
                <span>
                  Check out the repo on{" "}
                  <a
                    href="https://github.com/pillarhq/pillar"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[#1A1A1A] underline decoration-[#FF6E00]/40 underline-offset-4 transition hover:decoration-[#FF6E00]"
                  >
                    GitHub
                  </a>
                  .
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function JobsPage() {
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
      <JobsPageContent />
    </QueryClientProvider>
  );
}

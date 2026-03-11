 "use client";

import { ContactUsForm } from "@/components/ContactUsForm";
import { ArrowUpRight } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo } from "react";

function ContactPageContent() {
  return (
    <div>
      <section className="px-6 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-14 lg:items-start">
            <div className="max-w-sm pt-4">
              <h1 className="text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] text-[#1A1A1A] sm:text-[44px]">
                Contact.
              </h1>
              <div className="mt-8 space-y-5 text-[15px] leading-7 text-[#5F5A55]">
                <p>
                  We&apos;re based in San Francisco. If you&apos;re working on
                  something interesting and want to talk through Pillar, send us
                  a note.
                </p>
                <p>
                  If you&apos;re nearby, we&apos;d be down to grab a coffee.
                </p>
                <p className="text-sm leading-6 text-[#6B655E]">
                  You can also reach us directly at{" "}
                  <a
                    href="mailto:founders@trypillar.com"
                    className="font-medium text-[#1A1A1A] underline decoration-[#D5C4B2] underline-offset-4"
                  >
                    founders@trypillar.com
                  </a>{" "}
                  or{" "}
                  <a
                    href="mailto:support@trypillar.com"
                    className="font-medium text-[#1A1A1A] underline decoration-[#D5C4B2] underline-offset-4"
                  >
                    support@trypillar.com
                  </a>
                  .
                </p>
              </div>
            </div>

            <div>
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
